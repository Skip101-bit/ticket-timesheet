import Image from "next/image"
import { cn } from "@/lib/utils"

type RobowareLogoProps = {
  className?: string
}

export function RobowareLogo({ className }: RobowareLogoProps) {
  return (
    <Image
      src="/roboware-logo.png"
      alt="Roboware"
      width={256}
      height={243}
      className={cn("h-14 w-auto", className)}
      priority
    />
  )
}
