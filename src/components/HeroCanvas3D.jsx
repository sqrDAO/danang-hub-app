import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useTheme } from '../hooks/useTheme'

const FOV = 48
const CAM_Z = 26
const STEP = 1.6

const PALETTES = {
  dark: {
    dark: 0x472900, mid: 0x784400, accent: 0x9A5B00, wire: 0x5C3500, particle: 0x784400,
    base: 0.32, faint: 0.12, wireOp: 0.22
  },
  light: {
    dark: 0xD8C3A5, mid: 0xC7AC8A, accent: 0xB6926B, wire: 0xA58157, particle: 0xB89972,
    base: 0.26, faint: 0.10, wireOp: 0.16
  }
}

const getPal = (theme) => PALETTES[theme === 'light' ? 'light' : 'dark']

const meshMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity })

const boxed = (x, y, z) => {
  const geo = new THREE.BoxGeometry(x, y, z)
  return { geo, edges: new THREE.EdgesGeometry(geo) }
}

const addBoxed = (group, geos, fill, stroke, data) => {
  const mesh = new THREE.Mesh(geos.geo, fill)
  mesh.add(new THREE.LineSegments(geos.edges, stroke))
  mesh.position.set(data.x, data.y, data.z)
  mesh.userData = data
  group.add(mesh)
  return mesh
}

const gridBounds = (width, height) => {
  const visH = 2 * Math.tan((FOV * Math.PI) / 360) * CAM_Z
  const visW = visH * (width / height)
  return {
    cols: Math.max(6, Math.ceil(visW / STEP) + 2),
    rows: Math.max(8, Math.ceil(visH / STEP) + 2),
    visW,
    visH
  }
}

const isVoidCell = (r, c) => {
  const noise = Math.sin(r * 0.85) * Math.cos(c * 0.95) + Math.sin((r + c) * 0.4) * 0.3
  return noise < -0.38 || ((r + c) % 2 === 0 && noise < -0.1)
}

const tint = (material, hex, opacity) => {
  material.color.setHex(hex)
  if (opacity != null) material.opacity = opacity
}

const applyPalette = (world, pal) => {
  const { tiles: t, quads: q, particles: p } = world
  tint(t.dark, pal.dark, pal.faint)
  tint(t.mid, pal.mid, pal.base)
  tint(t.accent, pal.accent, pal.base * 0.8)
  tint(t.wire, pal.wire, pal.wireOp)
  tint(q.fill, pal.dark, pal.faint * 1.2)
  tint(q.stroke, pal.wire, pal.wireOp)
  tint(p.mat, pal.particle)
}

const makeTiles = (bounds, pal) => {
  const group = new THREE.Group()
  const geos = boxed(1.32, 1.32, 0.044)
  const dark = meshMat(pal.dark, pal.faint)
  const mid = meshMat(pal.mid, pal.base)
  const accent = meshMat(pal.accent, pal.base * 0.8)
  const wire = lineMat(pal.wire, pal.wireOp)
  const shades = [dark, mid, accent]
  const list = []
  for (let r = 0; r < bounds.rows; r++) {
    for (let c = 0; c < bounds.cols; c++) {
      if (isVoidCell(r, c)) continue
      const x = (c - bounds.cols / 2) * STEP
      const y = (r - bounds.rows / 2) * STEP
      list.push(addBoxed(group, geos, shades[(r + c) % 3], wire, {
        x, y, z: 0, phase: r * 0.35 + c * 0.4
      }))
    }
  }
  return { group, list, geos, dark, mid, accent, wire }
}

const makeQuads = (count, bounds, pal) => {
  const group = new THREE.Group()
  const geos = boxed(0.88, 0.88, 0.033)
  const fill = meshMat(pal.dark, pal.faint * 1.2)
  const stroke = lineMat(pal.wire, pal.wireOp)
  const spanX = Math.max(20, bounds.visW + 6)
  const spanY = Math.max(16, bounds.visH + 4)
  const list = []
  for (let i = 0; i < count; i++) {
    list.push(addBoxed(group, geos, fill, stroke, {
      x: (Math.random() - 0.5) * spanX,
      y: (Math.random() - 0.5) * spanY,
      z: (Math.random() - 0.5) * 10 - 1,
      speed: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2
    }))
  }
  return { group, list, geos, fill, stroke }
}

const makeParticles = (count, bounds, pal) => {
  const geo = new THREE.BufferGeometry()
  const coords = new Float32Array(count * 3)
  const spanX = Math.max(24, bounds.visW + 10)
  const spanY = Math.max(20, bounds.visH + 8)
  for (let i = 0; i < coords.length; i += 3) {
    coords[i] = (Math.random() - 0.5) * spanX
    coords[i + 1] = (Math.random() - 0.5) * spanY
    coords[i + 2] = (Math.random() - 0.5) * 20
  }
  geo.setAttribute('position', new THREE.BufferAttribute(coords, 3))
  const mat = new THREE.PointsMaterial({
    color: pal.particle, size: 0.16, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending
  })
  return { field: new THREE.Points(geo, mat), geo, mat }
}

const disposeWorld = (world) => {
  if (!world) return
  const { tiles: t, quads: q, particles: p } = world
  ;[t.geos.geo, t.geos.edges, t.dark, t.mid, t.accent, t.wire,
    q.geos.geo, q.geos.edges, q.fill, q.stroke, p.geo, p.mat].forEach(item => item.dispose())
}

const buildWorld = (width, height, pal) => {
  const bounds = gridBounds(width, height)
  const slots = bounds.cols * bounds.rows
  return {
    bounds,
    tiles: makeTiles(bounds, pal),
    quads: makeQuads(Math.max(6, Math.round(slots * 0.04)), bounds, pal),
    particles: makeParticles(Math.max(18, Math.round(slots * 0.15)), bounds, pal)
  }
}

const waveTiles = (list, time) => {
  for (let i = 0; i < list.length; i++) {
    const { x, y, phase } = list[i].userData
    list[i].position.set(
      x,
      y + Math.sin(x * 0.12 + time * 0.35) * 0.18,
      Math.sin(phase + time * 0.65) * 0.8 + Math.cos(y * 0.2 + time * 0.5) * 0.5
    )
  }
}

const driftQuads = (list, time) => {
  for (let i = 0; i < list.length; i++) {
    const { x, y, speed, phase } = list[i].userData
    list[i].position.x = x + Math.cos(time * speed * 0.6 + phase) * 0.3
    list[i].position.y = y + Math.sin(time * speed + phase) * 0.4
  }
}

const idleSession = { cleanup: () => {}, sync: () => {} }

const createRenderer = (container) => {
  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true, antialias: true, powerPreference: 'high-performance'
    })
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    return renderer
  } catch {
    return null
  }
}

const releaseRenderer = (renderer) => {
  renderer.dispose()
  renderer.forceContextLoss()
  renderer.domElement.remove()
}

const fitRenderer = (camera, renderer, w, h) => {
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

const detachWorld = (root, scene, world) => {
  if (!world) return
  root.remove(world.tiles.group, world.quads.group)
  scene.remove(world.particles.field)
  disposeWorld(world)
}

const attachWorld = (root, scene, pal, size) => {
  const world = buildWorld(size.w, size.h, pal)
  root.add(world.tiles.group, world.quads.group)
  scene.add(world.particles.field)
  return world
}

const syncTheme = (themeRef, theme, world) => {
  if (themeRef.current === theme) return theme
  applyPalette(world, getPal(themeRef.current))
  return themeRef.current
}

const stepWorld = (world, time) => {
  waveTiles(world.tiles.list, time)
  driftQuads(world.quads.list, time)
  world.particles.field.rotation.y += 0.0003
  world.particles.field.rotation.x += 0.0001
}

const attachLoop = (ctx) => {
  let animId = 0
  let theme = ctx.themeRef.current
  const running = () => ctx.getVisible() && !ctx.getReduced()

  const draw = (animate) => {
    const world = ctx.getWorld()
    if (!world) return
    theme = syncTheme(ctx.themeRef, theme, world)
    if (animate) stepWorld(world, ctx.clock.getElapsedTime())
    ctx.renderer.render(ctx.scene, ctx.camera)
  }

  const tick = () => {
    if (!running()) {
      animId = 0
      return
    }
    animId = requestAnimationFrame(tick)
    draw(true)
  }

  const stop = () => {
    if (!animId) return
    cancelAnimationFrame(animId)
    animId = 0
  }

  const sync = () => {
    if (running()) {
      if (!animId) tick()
      return
    }
    stop()
    draw(false)
  }

  return { sync, stop }
}

const bindCanvasEvents = (loop, state) => {
  const onVisibility = () => {
    state.visible = !document.hidden
    loop.sync()
  }
  const onMotion = () => {
    state.reduced = state.mq.matches
    loop.sync()
  }
  const onResize = () => {
    clearTimeout(state.resizeTimer)
    state.resizeTimer = setTimeout(() => state.resize(), 150)
  }
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  state.mq.addEventListener('change', onMotion)
  return () => {
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    state.mq.removeEventListener('change', onMotion)
  }
}

const setupCanvas = (container, themeRef) => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const scene = new THREE.Scene()
  const root = new THREE.Group()
  scene.add(root)
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000)
  camera.position.z = CAM_Z
  const renderer = createRenderer(container)
  if (!renderer) return idleSession

  let world = null
  const state = { mq, reduced: mq.matches, visible: !document.hidden, resizeTimer: 0 }
  const remount = (w, h) => {
    detachWorld(root, scene, world)
    world = attachWorld(root, scene, getPal(themeRef.current), { w, h })
  }
  state.resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    fitRenderer(camera, renderer, w, h)
    const next = gridBounds(w, h)
    if (next.cols !== world.bounds.cols || next.rows !== world.bounds.rows) remount(w, h)
  }

  const loop = attachLoop({
    renderer, scene, camera, themeRef,
    getWorld: () => world,
    clock: new THREE.Clock(),
    getReduced: () => state.reduced,
    getVisible: () => state.visible
  })
  fitRenderer(camera, renderer, window.innerWidth, window.innerHeight)
  remount(window.innerWidth, window.innerHeight)
  const unbind = bindCanvasEvents(loop, state)
  loop.sync()

  const cleanup = () => {
    loop.stop()
    clearTimeout(state.resizeTimer)
    unbind()
    detachWorld(root, scene, world)
    releaseRenderer(renderer)
  }
  return { cleanup, sync: loop.sync }
}

const HeroCanvas3D = () => {
  const containerRef = useRef(null)
  const sessionRef = useRef(null)
  const { theme } = useTheme()
  const themeRef = useRef(theme)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const session = setupCanvas(el, themeRef)
    sessionRef.current = session
    return () => {
      session.cleanup()
      sessionRef.current = null
    }
  }, [])

  useEffect(() => {
    themeRef.current = theme
    sessionRef.current?.sync()
  }, [theme])

  return <div ref={containerRef} className="hero-3d-canvas-container" aria-hidden="true" />
}

export default HeroCanvas3D
