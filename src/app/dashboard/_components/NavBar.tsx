import { BrandLogo } from "@/components/BrandLogo"
import { UserButton } from "@clerk/nextjs"
import { UploadIcon } from "lucide-react"
import Link from "next/link"

export function NavBar() {
  return (
    <header className="flex py-4 shadow bg-background">
      <nav className="flex items-center gap-10 container">
        <Link className="mr-auto" href="/dashboard">
          <BrandLogo />
        </Link>
        <Link href="/dashboard/upload" className="flex items-center gap-1">
          <UploadIcon className="size-4" />
          Upload
        </Link>
        <Link href="/dashboard/analytics">Analytics</Link>
        <Link href="/dashboard/bets">Bet History</Link>
        <Link href="/dashboard/subscription">Subscription</Link>
        <UserButton />
      </nav>
    </header>
  )
}
