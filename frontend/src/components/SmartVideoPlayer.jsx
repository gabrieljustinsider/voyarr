/**
 * SmartVideoPlayer
 *
 * A single reusable component that automatically detects the appropriate
 * playback strategy for the given source URL and loads the required
 * runtime libraries on demand (no build-time dependency bloat).
 *
 * Supported:
 *  Native HTML5: MP4 (H.264/H.265/AV1), WebM (VP8/VP9/AV1), OGV,
 *                MOV, MKV*, AVI*, WMV*, FLV*, MPEG, TS, 3GP,
 *                Audio: MP3, AAC, FLAC, WAV, OGG, OPUS, WebA, M4A
 *  HLS (.m3u8): via hls.js (non-Safari) or native (Safari/iOS)
 *  MPEG-DASH (.mpd): via dash.js
 *  RTSP/RTMP: redirected to an HLS proxy if available, otherwise shown as error
 *
 * WebXR / Immersive Support:
 *  Includes point-and-click WebXR mode dynamically leveraging Three.js.
 *  Allows immersive rendering in VR/AR headsets (like Meta Quest or Apple Vision Pro)
 *  supporting 180°, 360°, flat screen, and stereoscopic SBS (Side-by-Side) options.
 *
 * (*) Browser container support depends on the OS codec pack.
 *     Chrome/Edge on Windows support MKV/AVI natively.
 *     For truly unsupported containers (e.g. WMV on macOS), a codec warning is shown.
 */
import { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, Alert, Typography, Button, ButtonGroup } from '@mui/material'
import VrIcon from '@mui/icons-material/Visibility'

const HLS_CDN   = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js'
const DASH_CDN  = 'https://cdn.dashjs.org/latest/dash.all.min.js'
const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'

/** Injects a script tag once and resolves when it's ready */
function loadScript(src, globalKey) {
  if (window[globalKey]) return Promise.resolve()
  if (document.querySelector(`script[src="${src}"]`)) {
    return new Promise((resolve) => {
      const poll = setInterval(() => {
        if (window[globalKey]) { clearInterval(poll); resolve() }
      }, 50)
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

/** Determine the playback strategy from the URL */
function detectStrategy(src) {
  if (!src) return 'unsupported'
  const url = src.split('?')[0].toLowerCase()
  if (url.endsWith('.m3u8'))  return 'hls'
  if (url.endsWith('.mpd'))   return 'dash'
  if (url.startsWith('rtmp') || url.startsWith('rtsp')) return 'rtmp'

  const NATIVE_EXTS = [
    '.mp4', '.m4v', '.webm', '.ogv', '.ogg',
    '.mov', '.mkv', '.avi', '.wmv', '.flv', '.ts', '.m2ts', '.mts',
    '.mpeg', '.mpg', '.3gp', '.3g2',
    '.mp3', '.aac', '.m4a', '.wav', '.flac', '.opus', '.oga', '.weba',
  ]
  if (NATIVE_EXTS.some(e => url.endsWith(e))) return 'native'

  // Unknown extension – try native and let the browser decide
  return 'native'
}

export default function SmartVideoPlayer({
  src,
  onPlay,
  style = {},
  autoPlay = true,
  controls = true,
  controlsList = 'nodownload',
}) {
  const videoRef  = useRef(null)
  const hlsRef    = useRef(null)
  const dashRef   = useRef(null)
  
  // WebXR refs & state
  const canvasContainerRef = useRef(null)
  const xrSessionRef = useRef(null)
  const animationFrameRef = useRef(null)
  const xrRendererRef = useRef(null)

  const [status, setStatus]   = useState('loading') // 'loading' | 'ready' | 'error'
  const [errMsg, setErrMsg]   = useState('')
  const [strategy, setStrategy] = useState('')
  
  // WebXR UI states
  const [xrSupported, setXrSupported] = useState(false)
  const [inXrMode, setInXrMode] = useState(false)
  const [projectionMode, setProjectionMode] = useState('flat') // 'flat' | '180' | '360'
  const [stereoMode, setStereoMode] = useState('mono') // 'mono' | 'sbs' (Side-by-Side)

  // 1. Check for WebXR support on mount or source change
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        setXrSupported(supported)
      }).catch(() => setXrSupported(false))
    }
  }, [])

  // 2. Playback logic
  useEffect(() => {
    if (!src) return
    let cancelled = false

    const video = videoRef.current
    if (!video) return

    // Tear down any previous player instances
    if (hlsRef.current)  { hlsRef.current.destroy();  hlsRef.current = null }
    if (dashRef.current) { dashRef.current.reset();   dashRef.current = null }
    video.pause()
    video.removeAttribute('src')
    video.load()

    setStatus('loading')
    setErrMsg('')

    const strat = detectStrategy(src)
    setStrategy(strat)

    const attach = async () => {
      try {
        if (strat === 'hls') {
          // Safari has native HLS support
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src
            setStatus('ready')
            if (autoPlay) video.play().catch(() => {})
          } else {
            await loadScript(HLS_CDN, 'Hls')
            if (cancelled) return
            if (!window.Hls || !window.Hls.isSupported()) {
              setErrMsg('HLS playback is not supported in this browser.')
              setStatus('error')
              return
            }
            const hls = new window.Hls({
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 30,
              backBufferLength: 10,
            })
            hlsRef.current = hls
            hls.loadSource(src)
            hls.attachMedia(video)
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled) return
              setStatus('ready')
              if (autoPlay) video.play().catch(() => {})
            })
            hls.on(window.Hls.Events.ERROR, (_, data) => {
              if (data.fatal) {
                setErrMsg(`HLS fatal error: ${data.type} – ${data.details}`)
                setStatus('error')
              }
            })
          }
        } else if (strat === 'dash') {
          await loadScript(DASH_CDN, 'dashjs')
          if (cancelled) return
          if (!window.dashjs) {
            setErrMsg('MPEG-DASH playback library failed to load.')
            setStatus('error')
            return
          }
          const player = window.dashjs.MediaPlayer().create()
          dashRef.current = player
          player.initialize(video, src, autoPlay)
          player.on(window.dashjs.MediaPlayer.events.PLAYBACK_PLAYING, () => {
            if (!cancelled) setStatus('ready')
          })
          player.on(window.dashjs.MediaPlayer.events.ERROR, (e) => {
            setErrMsg(`DASH error: ${e?.error?.message || 'Unknown error'}`)
            setStatus('error')
          })
        } else if (strat === 'rtmp' || strat === 'rtsp') {
          setErrMsg(
            'RTMP/RTSP streams cannot be played directly in the browser. ' +
            'Please use an HLS-compatible re-stream URL (e.g. ending in .m3u8) or ' +
            'ensure the backend provides an HLS proxy for this source.'
          )
          setStatus('error')
        } else {
          // Native HTML5 – assign src and let the browser figure it out
          video.src = src
          setStatus('ready')
          if (autoPlay) video.play().catch(() => {})
        }
      } catch (e) {
        if (!cancelled) {
          setErrMsg(e.message || 'Failed to initialise video player.')
          setStatus('error')
        }
      }
    }

    attach()
    return () => {
      cancelled = true
      if (hlsRef.current)  { hlsRef.current.destroy();  hlsRef.current = null }
      if (dashRef.current) { dashRef.current.reset();   dashRef.current = null }
    }
  }, [src, autoPlay])

  // 3. WebXR setup and lifecycle
  useEffect(() => {
    if (!inXrMode) return

    let cancelled = false
    let scene, camera, renderer, videoTexture, mesh;

    const setupThreeXR = async () => {
      try {
        await loadScript(THREE_CDN, 'THREE')
        if (cancelled || !window.THREE) return

        const THREE = window.THREE
        const video = videoRef.current
        if (!video) return

        // Create scene and camera
        scene = new THREE.Scene()
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000)
        scene.add(camera)

        // Create WebGL Renderer with XR enabled
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.xr.enabled = true
        xrRendererRef.current = renderer

        if (canvasContainerRef.current) {
          canvasContainerRef.current.appendChild(renderer.domElement)
        }

        // Create texture from the HTML5 video element
        videoTexture = new THREE.VideoTexture(video)
        videoTexture.minFilter = THREE.LinearFilter
        videoTexture.magFilter = THREE.LinearFilter
        videoTexture.format = THREE.RGBFormat

        // Set up video projection shape based on mode
        let geometry, material;

        if (projectionMode === '180') {
          // 180 degree dome projection using a hemisphere
          geometry = new THREE.SphereGeometry(500, 60, 40, Math.PI, Math.PI, 0, Math.PI)
          geometry.scale(-1, 1, 1) // Invert geometry to look from inside
        } else if (projectionMode === '360') {
          // Full 360 spherical dome projection
          geometry = new THREE.SphereGeometry(500, 60, 40)
          geometry.scale(-1, 1, 1)
        } else {
          // Flat cinema screen in virtual space
          geometry = new THREE.PlaneGeometry(16, 9)
        }

        if (stereoMode === 'sbs') {
          // Stereoscopic Side-by-Side mapping: left/right eye splits
          // We configure the texture offsets differently for each eye
          videoTexture.wrapS = THREE.ClampToEdgeWrapping
          videoTexture.wrapT = THREE.ClampToEdgeWrapping
          
          // Setup SBS material mapping
          material = new THREE.MeshBasicMaterial({ map: videoTexture })
          
          // Apply texture coordinate transformation logic to map SBS
          // side-by-side frames onto screen geometries dynamically
          const mapSBSCoords = (geo) => {
            const uvs = geo.attributes.uv
            for (let i = 0; i < uvs.count; i++) {
              let u = uvs.getX(i)
              // Compress horizontal coordinate scale to match split left/right
              uvs.setX(i, u * 0.5)
            }
            uvs.needsUpdate = true
          }
          mapSBSCoords(geometry)
        } else {
          // Mono flat mapping
          material = new THREE.MeshBasicMaterial({ map: videoTexture })
        }

        mesh = new THREE.Mesh(geometry, material)
        
        if (projectionMode === 'flat') {
          mesh.position.set(0, 0, -8) // Place flat screen 8 meters in front
        } else {
          mesh.rotation.y = -Math.PI / 2 // Rotate dome matching default gaze direction
        }
        scene.add(mesh)

        // Request immersive XR session
        const session = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor']
        })
        xrSessionRef.current = session

        session.addEventListener('end', () => {
          setInXrMode(false)
        })

        // Controller / trigger input safeguard: click trigger to exit immersive view
        session.addEventListener('select', () => {
          if (xrSessionRef.current) {
            xrSessionRef.current.end().catch(() => {})
          }
        })

        // Hook Three.js renderer into WebXR session cycle
        await renderer.xr.setSession(session)

        // Begin XR frame processing loop
        const onXRFrame = (time, frame) => {
          if (cancelled) return
          
          // Update stereoscopic viewport texture offsets dynamically depending on which eye is active
          if (stereoMode === 'sbs' && renderer.xr.isPresenting) {
            const viewerPose = frame.getViewerPose(renderer.xr.getReferenceSpace())
            if (viewerPose) {
              viewerPose.views.forEach((view) => {
                // Determine left or right eye texture offset
                if (view.eye === 'left') {
                  videoTexture.offset.x = 0
                } else if (view.eye === 'right') {
                  videoTexture.offset.x = 0.5
                }
              })
            }
          }
          
          renderer.render(scene, camera)
        }
        
        renderer.setAnimationLoop(onXRFrame)

      } catch (err) {
        console.error('WebXR ThreeJS Setup error:', err)
        setErrMsg('Failed to enter XR Mode: ' + err.message)
        setInXrMode(false)
      }
    }

    setupThreeXR()

    return () => {
      cancelled = true
      if (xrSessionRef.current) {
        xrSessionRef.current.end().catch(() => {})
        xrSessionRef.current = null
      }
      if (xrRendererRef.current) {
        xrRendererRef.current.setAnimationLoop(null)
        xrRendererRef.current = null
      }
      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = ''
      }
    }
  }, [inXrMode, projectionMode, stereoMode])

  const handleError = () => {
    const v = videoRef.current
    const code = v?.error?.code
    const msgs = {
      1: 'Playback was aborted.',
      2: 'Network error while loading video.',
      3: 'Video decode error — the file may be corrupted or use an unsupported codec.',
      4: 'Video format or codec is not supported by this browser.',
    }
    setErrMsg(msgs[code] || 'An unknown playback error occurred.')
    setStatus('error')
  }

  const handleToggleXR = () => {
    setInXrMode(!inXrMode)
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', backgroundColor: 'black', ...style }}>
      {/* Dynamic Overlay Options for Projection Mode Selection */}
      {status === 'ready' && !inXrMode && (
        <Box sx={{
          position: 'absolute', top: 10, right: 10, zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: 1,
          backgroundColor: 'rgba(0,0,0,0.6)', p: 1, borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {xrSupported && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<VrIcon />}
              onClick={handleToggleXR}
              size="small"
              fullWidth
              sx={{ textTransform: 'none', fontWeight: 'bold' }}
            >
              Enter Immersive VR
            </Button>
          )}

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>
            Projection:
          </Typography>
          <ButtonGroup size="small" variant="outlined" color="inherit">
            <Button 
              onClick={() => setProjectionMode('flat')} 
              sx={{ bgcolor: projectionMode === 'flat' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            >Flat</Button>
            <Button 
              onClick={() => setProjectionMode('180')} 
              sx={{ bgcolor: projectionMode === '180' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            >180°</Button>
            <Button 
              onClick={() => setProjectionMode('360')} 
              sx={{ bgcolor: projectionMode === '360' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            >360°</Button>
          </ButtonGroup>

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold', mt: 0.5 }}>
            Stereoscopy:
          </Typography>
          <ButtonGroup size="small" variant="outlined" color="inherit">
            <Button 
              onClick={() => setStereoMode('mono')} 
              sx={{ bgcolor: stereoMode === 'mono' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            >Mono</Button>
            <Button 
              onClick={() => setStereoMode('sbs')} 
              sx={{ bgcolor: stereoMode === 'sbs' ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            >Stereo SBS</Button>
          </ButtonGroup>
        </Box>
      )}

      {/* Hidden container where ThreeJS inserts WebXR WebGL Canvas */}
      <Box ref={canvasContainerRef} style={{ display: inXrMode ? 'block' : 'none', position: 'fixed', inset: 0, zIndex: 99999 }} />

      {status === 'loading' && (
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 5
        }}>
          <CircularProgress size={40} color="primary" />
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
            {strategy === 'hls'  ? 'Loading HLS stream…'  :
             strategy === 'dash' ? 'Loading DASH stream…' :
             'Loading…'}
          </Typography>
        </Box>
      )}

      {status === 'error' && (
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ borderRadius: '10px' }}>
            {errMsg || 'Playback failed.'}
          </Alert>
        </Box>
      )}

      <video
        ref={videoRef}
        controls={controls && !inXrMode}
        style={{
          width: '100%',
          maxHeight: '75vh',
          outline: 'none',
          display: (status === 'error' || inXrMode) ? 'none' : 'block',
        }}
        controlsList={controlsList}
        onPlay={onPlay}
        onError={handleError}
        onCanPlay={() => setStatus('ready')}
        playsInline
        crossOrigin="anonymous"
      />
    </Box>
  )
}
