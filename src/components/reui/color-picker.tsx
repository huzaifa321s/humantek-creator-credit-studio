"use client"

import * as React from "react"
import { Pipette, Plus, Check, Palette, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ============================================================================
// Color Math Utilities (HEX <-> HSV / RGB)
// ============================================================================

export interface HSV {
  h: number // 0 - 360
  s: number // 0 - 100
  v: number // 0 - 100
}

export function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

export function normalizeHex(hex: string): string | null {
  const clean = hex.trim().replace(/^#/, "")
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const r = clean[0] + clean[0]
    const g = clean[1] + clean[1]
    const b = clean[2] + clean[2]
    return `#${(r + g + b).toUpperCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toUpperCase()}`
  }
  return null
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const clean = normalized.slice(1)
  const num = parseInt(clean, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2
    } else {
      h = (rNorm - gNorm) / delta + 4
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 100)
  const v = Math.round(max * 100)

  return { h, s, v }
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sNorm = clamp(s, 0, 100) / 100
  const vNorm = clamp(v, 0, 100) / 100
  const c = vNorm * sNorm
  const hh = (clamp(h, 0, 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const m = vNorm - c

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hh >= 0 && hh < 1) {
    r1 = c
    g1 = x
  } else if (hh >= 1 && hh < 2) {
    r1 = x
    g1 = c
  } else if (hh >= 2 && hh < 3) {
    g1 = c
    b1 = x
  } else if (hh >= 3 && hh < 4) {
    g1 = x
    b1 = c
  } else if (hh >= 4 && hh < 5) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  }
}

export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex)
  if (!rgb) return { h: 330, s: 100, v: 100 }
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v)
  return rgbToHex(r, g, b)
}

/**
 * Extracts all unique normalized `#RRGGBB` hex codes from a free-text string
 */
export function extractHexColors(text?: string): string[] {
  if (!text) return []
  const matches = text.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []
  const unique: string[] = []
  for (const m of matches) {
    const norm = normalizeHex(m)
    if (norm && !unique.includes(norm)) {
      unique.push(norm)
    }
  }
  return unique
}

// ============================================================================
// Creator Preset Swatches
// ============================================================================

export interface ColorPreset {
  hex: string
  name: string
}

export const CREATOR_COLOR_PRESETS: ColorPreset[] = [
  { hex: "#FF007F", name: "Neon Pink" },
  { hex: "#00F0FF", name: "Cyber Cyan" },
  { hex: "#F59E0B", name: "Studio Gold" },
  { hex: "#8B5CF6", name: "Electric Violet" },
  { hex: "#10B981", name: "Emerald Glow" },
  { hex: "#EF4444", name: "Crimson Red" },
  { hex: "#3B82F6", name: "Cobalt Blue" },
  { hex: "#EC4899", name: "Sakura Magenta" },
  { hex: "#A855F7", name: "Neon Purple" },
  { hex: "#14B8A6", name: "Mint Teal" },
  { hex: "#F97316", name: "Sunset Orange" },
  { hex: "#0F172A", name: "Deep Slate" },
]

const NAMED_COLOR_KEYWORDS: Array<{ pattern: RegExp; hex: string }> = [
  { pattern: /\bcrimson\b/i, hex: "#EF4444" },
  { pattern: /\bred\b/i, hex: "#EF4444" },
  { pattern: /\bpink\b/i, hex: "#FF007F" },
  { pattern: /\bmagenta\b/i, hex: "#EC4899" },
  { pattern: /\bsakura\b/i, hex: "#EC4899" },
  { pattern: /\bcyan\b/i, hex: "#00F0FF" },
  { pattern: /\bteal\b/i, hex: "#14B8A6" },
  { pattern: /\bmint\b/i, hex: "#14B8A6" },
  { pattern: /\bgold\b/i, hex: "#F59E0B" },
  { pattern: /\bamber\b/i, hex: "#F59E0B" },
  { pattern: /\byellow\b/i, hex: "#EAB308" },
  { pattern: /\borange\b/i, hex: "#F97316" },
  { pattern: /\bviolet\b/i, hex: "#8B5CF6" },
  { pattern: /\bpurple\b/i, hex: "#A855F7" },
  { pattern: /\bemerald\b/i, hex: "#10B981" },
  { pattern: /\bgreen\b/i, hex: "#10B981" },
  { pattern: /\bcobalt\b/i, hex: "#3B82F6" },
  { pattern: /\bblue\b/i, hex: "#3B82F6" },
  { pattern: /\bslate\b/i, hex: "#1E293B" },
  { pattern: /\bobsidian\b/i, hex: "#0F172A" },
  { pattern: /\bblack\b/i, hex: "#0F172A" },
  { pattern: /\bdark\b/i, hex: "#1E293B" },
  { pattern: /\bwhite\b/i, hex: "#F8FAFC" },
  { pattern: /\bsilver\b/i, hex: "#94A3B8" },
]

/**
 * Resolves visual hex swatches for display in project cards and details drawers.
 * Matches explicit `#HEX` codes first, then falls back to preset/named color keywords.
 */
export function resolvePaletteSwatches(text?: string): string[] {
  if (!text) return []
  const hexes = extractHexColors(text)
  if (hexes.length > 0) return hexes

  const matched: Array<{ index: number; hex: string }> = []
  for (const preset of CREATOR_COLOR_PRESETS) {
    const idx = text.toLowerCase().indexOf(preset.name.toLowerCase())
    if (idx !== -1) {
      matched.push({ index: idx, hex: preset.hex })
    }
  }
  for (const kw of NAMED_COLOR_KEYWORDS) {
    const m = kw.pattern.exec(text)
    if (m && m.index !== undefined) {
      matched.push({ index: m.index, hex: kw.hex })
    }
  }

  matched.sort((a, b) => a.index - b.index)
  const unique: string[] = []
  for (const item of matched) {
    if (!unique.includes(item.hex)) {
      unique.push(item.hex)
    }
  }
  return unique
}

// ============================================================================
// ReUI / Shadcn Composable ColorPicker Primitives
// ============================================================================

interface ColorPickerContextValue {
  hex: string
  hsv: HSV
  setHex: (hex: string) => void
  setHsv: (hsv: HSV) => void
}

const ColorPickerContext = React.createContext<ColorPickerContextValue | null>(null)

// Context to allow nested components (e.g., ColorPickerContent) to close the popover
const ColorPickerCloseContext = React.createContext<((open: boolean) => void) | null>(null)

function useColorPickerContext() {
  const ctx = React.useContext(ColorPickerContext)
  if (!ctx) {
    throw new Error("ColorPicker primitives must be used within <ColorPicker>")
  }
  return ctx
}

export interface ColorPickerProps {
  value?: string
  defaultValue?: string
  onValueChange?: (hex: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function ColorPicker({
  value,
  defaultValue = "#FF007F",
  onValueChange,
  open,
  onOpenChange,
  children,
}: ColorPickerProps) {
  const initialHex = normalizeHex(value || defaultValue) || "#FF007F"
  const [hsv, setHsvState] = React.useState<HSV>(() => hexToHsv(initialHex))
  const [internalHex, setInternalHex] = React.useState<string>(initialHex)

  const currentHex = value !== undefined ? normalizeHex(value) || internalHex : internalHex

  React.useEffect(() => {
    if (value !== undefined) {
      const norm = normalizeHex(value)
      if (norm && norm !== internalHex) {
        setInternalHex(norm)
        setHsvState(hexToHsv(norm))
      }
    }
  }, [value, internalHex])

  const setHsv = React.useCallback(
    (nextHsv: HSV) => {
      setHsvState(nextHsv)
      const nextHex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v)
      setInternalHex(nextHex)
      onValueChange?.(nextHex)
    },
    [onValueChange]
  )

  const setHex = React.useCallback(
    (nextRaw: string) => {
      const norm = normalizeHex(nextRaw)
      if (norm) {
        setInternalHex(norm)
        setHsvState(hexToHsv(norm))
        onValueChange?.(norm)
      }
    },
    [onValueChange]
  )

  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setInternalOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  return (
    <ColorPickerCloseContext.Provider value={handleOpenChange}>
      <ColorPickerContext.Provider value={{ hex: currentHex, hsv, setHex, setHsv }}>
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          {children}
        </Popover>
      </ColorPickerContext.Provider>
    </ColorPickerCloseContext.Provider>
  )
}

function ColorPickerClose() {
  const close = React.useContext(ColorPickerCloseContext)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Close color picker"
      onClick={() => close?.(false)}
      className="size-8"
    >
      <X className="size-4" />
    </Button>
  )
}

const ColorPickerTrigger = PopoverTrigger

function ColorPickerContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      data-slot="color-picker-content"
      align={align}
      sideOffset={sideOffset}
      className={cn("w-72 p-3 flex flex-col gap-3 rounded-xl shadow-lg border border-border/80", className)}
      {...props}
    >
      {props.children}
    </PopoverContent>
  )
}

/**
 * 2D Saturation / Brightness (Value) Interactive Canvas Area
 */
function ColorPickerArea({ className, ...props }: React.ComponentProps<"div">) {
  const { hsv, setHsv } = useColorPickerContext()
  const areaRef = React.useRef<HTMLDivElement>(null)
  const isDraggingRef = React.useRef(false)

  const updateFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const el = areaRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = clamp((clientX - rect.left) / rect.width, 0, 1)
      const y = clamp((clientY - rect.top) / rect.height, 0, 1)
      setHsv({
        h: hsv.h,
        s: Math.round(x * 100),
        v: Math.round((1 - y) * 100),
      })
    },
    [hsv.h, setHsv]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPointer(e.clientX, e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    updateFromPointer(e.clientX, e.clientY)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const pureHueHex = hsvToHex(hsv.h, 100, 100)
  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v)

  return (
    <div
      ref={areaRef}
      data-slot="color-picker-area"
      role="slider"
      aria-label="Color saturation and brightness"
      aria-valuenow={hsv.s}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 2
        if (e.key === "ArrowRight") {
          e.preventDefault()
          setHsv({ ...hsv, s: clamp(hsv.s + step, 0, 100) })
        } else if (e.key === "ArrowLeft") {
          e.preventDefault()
          setHsv({ ...hsv, s: clamp(hsv.s - step, 0, 100) })
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setHsv({ ...hsv, v: clamp(hsv.v + step, 0, 100) })
        } else if (e.key === "ArrowDown") {
          e.preventDefault()
          setHsv({ ...hsv, v: clamp(hsv.v - step, 0, 100) })
        }
      }}
      style={{ backgroundColor: pureHueHex }}
      className={cn(
        "relative h-36 w-full rounded-lg overflow-hidden cursor-crosshair select-none touch-none ring-1 ring-black/10 dark:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {/* White horizontal gradient (Saturation) */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to right, #FFFFFF, rgba(255,255,255,0))",
        }}
      />
      {/* Black vertical gradient (Brightness / Value) */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to top, #000000, rgba(0,0,0,0))",
        }}
      />
      {/* Thumb Indicator */}
      <div
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_4px_rgba(0,0,0,0.3)] transition-transform duration-75"
        style={{
          left: `${hsv.s}%`,
          top: `${100 - hsv.v}%`,
          backgroundColor: currentHex,
        }}
      />
    </div>
  )
}

/**
 * 1D Hue Spectrum Slider (0 - 360 deg)
 */
function ColorPickerSlider({ className, ...props }: React.ComponentProps<"div">) {
  const { hsv, setHsv } = useColorPickerContext()
  const trackRef = React.useRef<HTMLDivElement>(null)
  const isDraggingRef = React.useRef(false)

  const updateHue = React.useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
      setHsv({
        ...hsv,
        h: Math.round(ratio * 360),
      })
    },
    [hsv, setHsv]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateHue(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    updateHue(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const pureHueHex = hsvToHex(hsv.h, 100, 100)

  return (
    <div
      ref={trackRef}
      data-slot="color-picker-slider"
      role="slider"
      aria-label="Color hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={hsv.h}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 15 : 3
        if (e.key === "ArrowRight") {
          e.preventDefault()
          setHsv({ ...hsv, h: clamp(hsv.h + step, 0, 360) })
        } else if (e.key === "ArrowLeft") {
          e.preventDefault()
          setHsv({ ...hsv, h: clamp(hsv.h - step, 0, 360) })
        }
      }}
      style={{
        background:
          "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
      }}
      className={cn(
        "relative h-3 w-full rounded-full cursor-pointer select-none touch-none ring-1 ring-black/10 dark:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_1px_3px_rgba(0,0,0,0.3)]"
        style={{
          left: `${(hsv.h / 360) * 100}%`,
          backgroundColor: pureHueHex,
        }}
      />
    </div>
  )
}

/**
 * Hex Input Field + EyeDropper + Optional Action Button
 */
export interface ColorPickerFieldsProps extends React.ComponentProps<"div"> {
  onAddColor?: (hex: string, label?: string) => void
  addButtonLabel?: string
}

function ColorPickerFields({
  className,
  onAddColor,
  addButtonLabel = "Add",
  ...props
}: ColorPickerFieldsProps) {
  const { hex, setHex } = useColorPickerContext()
  const [draftHex, setDraftHex] = React.useState(hex)
  const [supportsEyeDropper, setSupportsEyeDropper] = React.useState(false)

  React.useEffect(() => {
    setDraftHex(hex)
  }, [hex])

  React.useEffect(() => {
    setSupportsEyeDropper(typeof window !== "undefined" && "EyeDropper" in window)
  }, [])

  const handleEyeDropper = async () => {
    if (typeof window === "undefined" || !("EyeDropper" in window)) return
    try {
      const EyeDropperCtor = (
        window as unknown as {
          EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> }
        }
      ).EyeDropper
      const dropper = new EyeDropperCtor()
      const result = await dropper.open()
      if (result?.sRGBHex) {
        setHex(result.sRGBHex)
      }
    } catch {
      // User canceled eyedropper
    }
  }

  const matchedPreset = CREATOR_COLOR_PRESETS.find(
    (p) => p.hex.toUpperCase() === hex.toUpperCase()
  )

  return (
    <div
      data-slot="color-picker-fields"
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    >
      {/* Live Swatch Preview */}
      <div
        className="size-8 rounded-lg shrink-0 ring-1 ring-black/15 dark:ring-white/15 shadow-2xs"
        style={{ backgroundColor: hex }}
        title={hex}
      />

      {/* HEX Text Input */}
      <Input
        value={draftHex}
        onChange={(e) => {
          const val = e.target.value
          setDraftHex(val)
          const norm = normalizeHex(val)
          if (norm) setHex(norm)
        }}
        onBlur={() => setDraftHex(hex)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            const norm = normalizeHex(draftHex) || hex
            setHex(norm)
            onAddColor?.(norm, matchedPreset?.name)
          }
        }}
        maxLength={7}
        aria-label="Hex color code"
        placeholder="#FF007F"
        className="h-8 font-mono text-xs uppercase px-2.5 flex-1 min-w-0"
      />

      {/* Native Browser EyeDropper */}
      {supportsEyeDropper && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={handleEyeDropper}
          title="Pick color from screen"
          aria-label="Pick color from screen"
          className="size-8 shrink-0 rounded-lg cursor-pointer"
        >
          <Pipette className="size-3.5" />
        </Button>
      )}

      {/* Optional Add to Palette Action */}
      {onAddColor && (
        <Button
          type="button"
          size="sm"
          onClick={() => onAddColor(hex, matchedPreset?.name)}
          className="h-8 px-2.5 text-xs font-semibold rounded-lg shrink-0 gap-1 cursor-pointer bg-amber-400 text-zinc-950 hover:bg-amber-300"
        >
          <Plus className="size-3.5 stroke-[2.5]" />
          {addButtonLabel}
        </Button>
      )}
    </div>
  )
}

/**
 * Preset Swatches Grid
 */
export interface ColorPickerSwatchesProps extends React.ComponentProps<"div"> {
  presets?: ColorPreset[]
  selectedHexes?: string[]
  onSelectPreset?: (preset: ColorPreset) => void
}

function ColorPickerSwatches({
  className,
  presets = CREATOR_COLOR_PRESETS,
  selectedHexes = [],
  onSelectPreset,
  ...props
}: ColorPickerSwatchesProps) {
  const { hex, setHex } = useColorPickerContext()

  return (
    <div data-slot="color-picker-swatches" className={cn("space-y-1.5", className)} {...props}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Creator Swatches
        </span>
        <span className="text-[10px] text-muted-foreground">Click to toggle</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {presets.map((preset) => {
          const isCurrent = hex.toUpperCase() === preset.hex.toUpperCase()
          const isInPalette = selectedHexes.some(
            (h) => h.toUpperCase() === preset.hex.toUpperCase()
          )
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => {
                setHex(preset.hex)
                onSelectPreset?.(preset)
              }}
              title={`${preset.name} (${preset.hex})`}
              aria-label={`${preset.name} ${preset.hex}`}
              style={{ backgroundColor: preset.hex }}
              className={cn(
                "group relative h-6 w-full rounded-md transition-all cursor-pointer ring-1 ring-black/15 dark:ring-white/15 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center",
                (isCurrent || isInPalette) &&
                  "ring-2 ring-foreground dark:ring-white shadow-xs"
              )}
            >
              {isInPalette && (
                <Check className="size-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] stroke-[3]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// High-Level Composed Component: ColorPaletteInput
// Combines free-form custom text input + Shadcn/ReUI Color Picker Popover
// ============================================================================

export interface ColorPaletteInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: string
  onChange: (nextValue: string) => void
  maxLength?: number
}

function ColorPaletteInput({
  value,
  onChange,
  maxLength = 200,
  className,
  ...inputProps
}: ColorPaletteInputProps) {
  const [pickerColor, setPickerColor] = React.useState("#FF007F")
  const detectedHexes = React.useMemo(() => extractHexColors(value), [value])

  // Keep picker color synced to the last hex in the input when detectedHexes changes
  React.useEffect(() => {
    if (detectedHexes.length > 0) {
      setPickerColor(detectedHexes[detectedHexes.length - 1])
    }
  }, [detectedHexes])

  const appendOrToggleColor = React.useCallback(
    (targetHex: string, label?: string, toggleIfPresent = false) => {
      const norm = normalizeHex(targetHex)
      if (!norm) return

      const regex = new RegExp(
        `${norm}(?:\\s+${label ? label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : ""})?`,
        "i"
      )

      const alreadyHasHex = detectedHexes.some(
        (h) => h.toUpperCase() === norm.toUpperCase()
      )

      if (alreadyHasHex && toggleIfPresent) {
        // Remove the token containing this hex from the comma-separated list
        const parts = value
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .filter((p) => !p.toUpperCase().includes(norm.toUpperCase()))
        onChange(parts.join(", "))
        return
      }

      if (alreadyHasHex && !toggleIfPresent) {
        return
      }

      const token = label ? `${norm} ${label}` : norm
      const trimmed = value.trim().replace(/,+\s*$/, "")
      const next = trimmed ? `${trimmed}, ${token}` : token
      if (maxLength && next.length > maxLength) {
        // Fallback to hex-only if label overflows maxLength
        const fallback = trimmed ? `${trimmed}, ${norm}` : norm
        onChange(fallback.slice(0, maxLength))
      } else {
        onChange(next)
      }
      void regex
    },
    [detectedHexes, maxLength, onChange, value]
  )

  const removeHexFromValue = React.useCallback(
    (hexToRemove: string) => {
      const parts = value
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
      const filtered = parts.filter(
        (p) => !p.toUpperCase().includes(hexToRemove.toUpperCase())
      )
      if (filtered.length !== parts.length) {
        onChange(filtered.join(", "))
      } else {
        // Fallback inline regex removal if user didn't use commas
        const next = value
          .replace(new RegExp(hexToRemove, "gi"), "")
          .replace(/\s{2,}/g, " ")
          .trim()
        onChange(next)
      }
    },
    [onChange, value]
  )

  return (
    <div className="space-y-1.5">
      <div className="relative flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Input
            {...inputProps}
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn("pr-28", className)}
          />
          {/* Inline interactive 'Pick color' pill button inside input right edge */}
          <ColorPicker value={pickerColor} onValueChange={setPickerColor}>
            <ColorPickerTrigger
              type="button"
              aria-label="Open color picker"
              title="Pick custom hex color or preset swatch"
              className="group/picker absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2.5 rounded-md border border-border/80 bg-secondary/75 hover:bg-amber-400/15 hover:border-amber-400/50 text-foreground inline-flex items-center gap-1.5 text-2xs font-semibold shadow-2xs transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {detectedHexes.length > 0 ? (
                <span
                  className="size-3.5 rounded-full ring-1 ring-black/20 dark:ring-white/25 shadow-2xs shrink-0 transition-transform group-hover/picker:scale-110"
                  style={{
                    backgroundColor: detectedHexes[detectedHexes.length - 1],
                  }}
                />
              ) : (
                <span
                  className="size-3.5 rounded-full ring-1 ring-black/20 dark:ring-white/25 shadow-2xs shrink-0 transition-transform group-hover/picker:scale-110"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #FF007F, #F59E0B, #10B981, #00F0FF, #3B82F6, #8B5CF6, #FF007F)",
                  }}
                />
              )}
              <span className="leading-none whitespace-nowrap">Pick color</span>
            </ColorPickerTrigger>

            <ColorPickerContent align="end">
              <div className="flex items-center justify-between">
  <span className="text-xs font-bold text-foreground">Color Picker</span>
  <span className="text-[11px] text-muted-foreground">Pick &amp; add to brief</span>
  <ColorPickerClose />
</div>

              <ColorPickerArea />
              <ColorPickerSlider />
              <ColorPickerFields
                onAddColor={(hex, name) => appendOrToggleColor(hex, name, false)}
                addButtonLabel="Add"
              />
              <ColorPickerSwatches
                selectedHexes={detectedHexes}
                onSelectPreset={(preset) =>
                  appendOrToggleColor(preset.hex, preset.name, true)
                }
              />

              {detectedHexes.length > 0 && (
                <div className="pt-1.5 border-t border-border/60 space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Active Hex Colors ({detectedHexes.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {detectedHexes.map((h) => (
                      <span
                        key={h}
                        onClick={() => setPickerColor(h)}
                        className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-md bg-secondary/70 border border-border/70 text-[11px] font-mono font-medium text-foreground cursor-pointer hover:bg-secondary transition-colors"
                      >
                        <span
                          className="size-2.5 rounded-full ring-1 ring-black/15 dark:ring-white/20 shrink-0"
                          style={{ backgroundColor: h }}
                        />
                        <span>{h}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeHexFromValue(h)
                          }}
                          aria-label={`Remove ${h}`}
                          className="size-3.5 rounded-xs flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </ColorPickerContent>
          </ColorPicker>
        </div>
      </div>

      {/* Inline interactive swatch pills below input when hex colors are present */}
      {detectedHexes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {detectedHexes.map((h) => {
            const preset = CREATOR_COLOR_PRESETS.find(
              (p) => p.hex.toUpperCase() === h.toUpperCase()
            )
            return (
              <span
                key={h}
                className="inline-flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 rounded-md bg-secondary/40 border border-border/60 text-2xs font-medium text-foreground"
              >
                <span
                  className="size-2.5 rounded-full ring-1 ring-black/15 dark:ring-white/20 shrink-0"
                  style={{ backgroundColor: h }}
                />
                <span className="font-mono">{h}</span>
                {preset && (
                  <span className="text-muted-foreground hidden sm:inline">
                    {preset.name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeHexFromValue(h)}
                  aria-label={`Remove ${h}`}
                  className="size-3.5 rounded-xs flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export {
  ColorPicker,
  ColorPickerTrigger,
  ColorPickerContent,
  ColorPickerArea,
  ColorPickerSlider,
  ColorPickerFields,
  ColorPickerSwatches,
  ColorPaletteInput,
}
