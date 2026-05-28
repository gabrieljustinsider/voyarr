import os
import socket
import sys
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s:     %(message)s')
logger = logging.getLogger("voyarr.start")

def is_port_in_use(port: int, host: str = "0.0.0.0") -> bool:  # nosec B104
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0

def main():
    host = os.getenv("HOST", "0.0.0.0")  # nosec B104
    port_env = os.getenv("PORT", "8000")
    if not port_env or not str(port_env).strip():
        port_env = "8000"
    
    try:
        port = int(port_env)
    except ValueError:
        logger.error(f"Invalid PORT environment variable: {port_env}. Must be an integer.")
        sys.exit(1)

    if is_port_in_use(port, host):
        logger.warning(f"Port {port} is already in use on {host}.")
        
        auto_alt = os.getenv("AUTO_PORT_FALLBACK", "false").lower() == "true"
        
        if auto_alt:
            original_port = port
            # Try next 10 ports
            for alt_port in range(port + 1, port + 11):
                if not is_port_in_use(alt_port, host):
                    logger.info(f"Automatically selected alternative port: {alt_port}")
                    port = alt_port
                    break
            else:
                logger.error(f"Could not find an available port near {original_port}. Please free up port {original_port} or manually set a different PORT.")
                sys.exit(1)
        else:
            logger.error(f"Port {port} is already in use. Please check if another instance is running, or change the PORT environment variable in your .env file.")
            logger.info("Tip: You can enable automatic fallback by setting AUTO_PORT_FALLBACK=true")
            sys.exit(1)

    # Update environment for uvicorn and child processes
    os.environ["PORT"] = str(port)
    
    ssl_cert_path = os.getenv("SSL_CERT_PATH")
    ssl_key_path = os.getenv("SSL_KEY_PATH")
    
    ssl_certfile = None
    ssl_keyfile = None
    
    if ssl_cert_path and ssl_key_path and os.path.exists(ssl_cert_path) and os.path.exists(ssl_key_path):
        ssl_certfile = ssl_cert_path
        ssl_keyfile = ssl_key_path
        logger.info("Starting uvicorn with SSL/TLS enabled.")
    elif ssl_cert_path or ssl_key_path:
        logger.warning("SSL configuration incomplete or files not found. Starting without SSL.")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        log_level="info",
        proxy_headers=True,
        forwarded_allow_ips="*",
        ssl_certfile=ssl_certfile,
        ssl_keyfile=ssl_keyfile
    )

if __name__ == "__main__":
    main()
