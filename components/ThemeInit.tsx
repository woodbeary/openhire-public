"use client"

import { useEffect } from "react"

export default function ThemeInit() {
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      if (mq.matches) root.classList.add("dark")
      else root.classList.remove("dark")
    }
    apply()
    mq.addEventListener?.("change", apply)
    return () => mq.removeEventListener?.("change", apply)
  }, [])
  return null
}

