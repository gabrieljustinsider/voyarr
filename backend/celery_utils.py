import os
from typing import Any, Callable
import redis
from redis.exceptions import LockError  # type: ignore
import functools
import hashlib
from contextlib import contextmanager

def get_redis_client() -> Any:
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    return redis.Redis.from_url(redis_url)  # type: ignore

@contextmanager
def redis_lock(lock_id: str, timeout_seconds: int = 60 * 15) -> Any:
    """
    Context manager to acquire a Redis lock.
    """
    client = get_redis_client()
    lock = client.lock(lock_id, timeout=timeout_seconds)  # type: ignore
    acquired = lock.acquire(blocking=False)
    try:
        yield acquired
    finally:
        if acquired:
            try:
                lock.release()
            except LockError:
                pass  # Lock already released or expired

def single_instance_task(
    timeout_seconds: int = 60 * 15,
    key_prefix: str = "celery_lock",
    include_args: bool = False
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    A decorator for Celery tasks to prevent duplicate or overlapping executions.
    """
    def task_exc(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Create a unique lock ID based on task name and optionally arguments
            task_name = func.__name__
            lock_id = f"{key_prefix}:{task_name}"
            
            if include_args:
                # Basic string representation of args/kwargs for hashing
                args_str = str(args) + str(kwargs)
                args_hash = hashlib.sha256(args_str.encode("utf-8")).hexdigest()
                lock_id = f"{lock_id}:{args_hash}"

            with redis_lock(lock_id, timeout_seconds) as acquired:
                if not acquired:
                    print(f"Task {task_name} is already running. Skipping execution.")
                    return None
                return func(*args, **kwargs)
        return wrapper
    return task_exc
