"use client";

import { motion } from "framer-motion";
import { Calendar, Cake, Award, Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@hrms/components/ui/card";
import { Badge } from "@hrms/components/ui/badge";
import { formatDate } from "@hrms/lib/utils";

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "leave" | "attendance" | "announcement" | "birthday" | "anniversary";
}

interface UpcomingItem {
  id: string;
  title: string;
  date: string;
  type: "birthday" | "anniversary";
}

const typeIcons = {
  birthday: Cake,
  anniversary: Award,
  announcement: Megaphone,
  leave: Calendar,
  attendance: Calendar,
};

export function RecentActivities({ activities }: { activities: ActivityItem[] }) {
  const items = activities.slice(0, 8);

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card glass className="flex h-full min-h-0 flex-col">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="text-base font-semibold">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {items.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              No recent activities
            </p>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {items.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-brand-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function UpcomingEvents({ events }: { events: UpcomingItem[] }) {
  return (
    <motion.div
      className="flex h-full min-h-0 flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <Card glass className="flex h-full min-h-0 flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="text-base font-semibold">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {events.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
              No upcoming events
            </p>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              {events.map((event) => {
                const Icon = typeIcons[event.type] || Calendar;
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"
                  >
                    <div className="rounded-lg bg-brand-500/10 p-2">
                      <Icon className="h-4 w-4 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                    </div>
                    <Badge variant="info" className="capitalize shrink-0">
                      {event.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-muted/50 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
