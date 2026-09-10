"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useSession as useNextSession } from "next-auth/react";
import { useSession } from "@hrms/lib/hrms-session";
import { fetchApi } from "@hrms/lib/api-client";
import { formatDate, formatDateTime, formatLocalDate } from "@hrms/lib/utils";
import { Button } from "@hrms/components/ui/button";
import { Label } from "@hrms/components/ui/label";
import { Textarea } from "@hrms/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@hrms/components/ui/dialog";
import { Card } from "@/components/ui";

interface AttendanceRecord {
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workingHours: number | null;
  isLate: boolean;
}

export function AttendanceCheckInCard({ userId: userIdProp }: { userId?: string } = {}) {
  const { data: session } = useSession();
  const { data: nextSession } = useNextSession();
  const queryClient = useQueryClient();
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const userId = userIdProp ?? session?.user?.id ?? nextSession?.user?.hrmsUserId;
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [lateReason, setLateReason] = useState("");

  const { data: checkInPreview } = useQuery({
    queryKey: ["attendance-check-in-preview", todayStr, userId],
    queryFn: () =>
      fetchApi<{
        workStartTime: string;
        lateThreshold: number;
        isLateNow: boolean;
        alreadyCheckedIn: boolean;
      }>("/api/attendance/check-in-preview"),
    enabled: !!userId && checkInOpen,
  });

  const { data: todayData, isLoading } = useQuery({
    queryKey: ["attendance-today", todayStr, userId],
    queryFn: () =>
      fetchApi<{ records: AttendanceRecord[] }>(
        `/api/attendance?userId=${userId}&fromDate=${todayStr}&toDate=${todayStr}&limit=1`,
      ),
    enabled: !!userId,
  });

  const checkInMutation = useMutation({
    mutationFn: (reason?: string) =>
      fetchApi("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          action: "check-in",
          lateReason: reason?.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Checked in successfully!");
      setCheckInOpen(false);
      setLateReason("");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: () =>
      fetchApi("/api/attendance", {
        method: "POST",
        body: JSON.stringify({ action: "check-out" }),
      }),
    onSuccess: () => {
      toast.success("Checked out successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!userId) return null;

  const today = todayData?.records[0] ?? null;
  const canCheckIn = !today?.checkIn;
  const canCheckOut = Boolean(today?.checkIn && !today?.checkOut);
  const isProcessing = checkInMutation.isPending || checkOutMutation.isPending;

  function submitCheckIn() {
    if (checkInPreview?.isLateNow && lateReason.trim().length < 5) {
      toast.error("Please provide a reason for your late arrival (minimum 5 characters).");
      return;
    }
    checkInMutation.mutate(lateReason);
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="bg-navy px-5 py-4 text-white">
          <p className="text-sm text-white/80">Today’s attendance</p>
          <p className="mt-1 font-display text-2xl">
            {isLoading ? "..." : today?.status?.replace(/_/g, " ") ?? "Not checked in"}
          </p>
          <p className="mt-1 text-sm text-white/70">{formatDate(now)}</p>
        </div>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Check in</p>
            <p className="mt-1 text-sm font-medium">
              {today?.checkIn ? formatDateTime(today.checkIn) : "—"}
              {today?.isLate ? <span className="ml-2 text-xs text-gold">Late</span> : null}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Check out</p>
            <p className="mt-1 text-sm font-medium">
              {today?.checkOut ? formatDateTime(today.checkOut) : "—"}
              {today?.workingHours != null ? (
                <span className="ml-2 text-xs text-muted">{today.workingHours.toFixed(1)} h</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-line px-5 py-4">
          <Button size="lg" onClick={() => { setLateReason(""); setCheckInOpen(true); }} disabled={!canCheckIn || isProcessing}>
            <LogIn className="h-5 w-5" />
            {checkInMutation.isPending ? "Checking in..." : "Check in"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => checkOutMutation.mutate()}
            disabled={!canCheckOut || isProcessing}
          >
            <LogOut className="h-5 w-5" />
            {checkOutMutation.isPending ? "Checking out..." : "Check out"}
          </Button>
        </div>
      </Card>

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check in</DialogTitle>
            <DialogDescription>
              {checkInPreview?.isLateNow
                ? "You are checking in late. Please provide a reason before continuing."
                : "Confirm your check-in for today."}
            </DialogDescription>
          </DialogHeader>
          {checkInPreview?.isLateNow && (
            <div className="space-y-2">
              <Label htmlFor="dashboard-late-reason">Reason for late *</Label>
              <Textarea
                id="dashboard-late-reason"
                placeholder="Briefly explain why you are late today..."
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCheckInOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCheckIn} disabled={checkInMutation.isPending}>
              {checkInMutation.isPending ? "Checking in..." : "Confirm check in"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
