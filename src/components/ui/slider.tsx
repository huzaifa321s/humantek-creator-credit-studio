import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none py-2.5 data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:px-2.5 cursor-pointer">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200/90 dark:bg-zinc-800 border border-zinc-300/80 dark:border-zinc-700/80 select-none data-[orientation=vertical]:w-2 data-[orientation=vertical]:h-full shadow-inner"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-400 dark:to-amber-500 rounded-full select-none data-[orientation=vertical]:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-5 shrink-0 rounded-full border-2 border-amber-500 dark:border-amber-400 bg-white dark:bg-zinc-950 shadow-md ring-amber-500/30 transition-[color,box-shadow,transform] select-none hover:scale-110 hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden active:scale-95 cursor-grab active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
