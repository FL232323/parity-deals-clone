"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { TrashIcon } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/**
 * Button component that allows users to clear all their betting data
 * Includes a confirmation dialog to prevent accidental deletion
 */
export function ClearDataButton() {
  const [isClearing, setIsClearing] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const clearData = async () => {
    try {
      setIsClearing(true)
      
      const response = await fetch("/api/betting/clear-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success",
          description: data.message || "All betting data has been cleared",
        })
        // Refresh the page to show the updated state
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to clear betting data",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error clearing data:", error)
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <TrashIcon className="mr-2 h-4 w-4" />
          Clear All Betting Data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete all your
            uploaded betting data, including single bets, parlays, and all associated
            statistics.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={clearData}
            disabled={isClearing}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isClearing ? "Clearing..." : "Yes, clear all data"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}