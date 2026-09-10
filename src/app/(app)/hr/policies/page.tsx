"use client";

import { useState } from "react";
import { useSession } from "@hrms/lib/hrms-session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FileText, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@hrms/components/ui/button";
import { Input } from "@hrms/components/ui/input";
import { Label } from "@hrms/components/ui/label";
import { Textarea } from "@hrms/components/ui/textarea";
import { Skeleton } from "@hrms/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hrms/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@hrms/components/ui/dialog";
import { apiFetch, apiFetchArray } from "@hrms/lib/client-api";
import { companyPolicySchema, type CompanyPolicyInput } from "@hrms/lib/validations";
import { canManagePolicies, canViewPolicies } from "@hrms/lib/permissions";
import type { RoleName } from "@prisma/hrms-client";

interface CompanyPolicy {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
}

export default function PoliciesPage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const role = session?.user?.role as RoleName | undefined;
  const canManage = role ? canManagePolicies(role) : false;
  const canView = role ? canViewPolicies(role) : false;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyPolicy | null>(null);

  const { data: policies = [], isLoading, isError, error } = useQuery({
    queryKey: ["policies"],
    queryFn: () => apiFetchArray<CompanyPolicy>("/api/policies"),
    enabled: status === "authenticated" && canView,
  });

  const form = useForm<CompanyPolicyInput>({
    resolver: zodResolver(companyPolicySchema),
    defaultValues: { title: "", content: "" },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    form.reset({ title: "", content: "" });
  }

  function openCreate() {
    setEditing(null);
    form.reset({ title: "", content: "" });
    setDialogOpen(true);
  }

  function openEdit(policy: CompanyPolicy) {
    setEditing(policy);
    form.reset({ title: policy.title, content: policy.content, sortOrder: policy.sortOrder });
    setDialogOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: (data: CompanyPolicyInput) =>
      apiFetch<CompanyPolicy>("/api/policies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Policy added");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompanyPolicyInput }) =>
      apiFetch<CompanyPolicy>(`/api/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: data.title, content: data.content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Policy updated");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/policies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Policy removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: CompanyPolicyInput) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
      return;
    }
    createMutation.mutate(data);
  }

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!canView) {
    return (
      <Card glass>
        <CardContent className="py-12 text-center text-muted-foreground">
          You do not have access to company policies.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink flex items-center gap-2">
            <FileText className="h-7 w-7 text-brand-600" />
            Company Policies
          </h1>
          <p className="text-muted-foreground mt-1">
            {canManage
              ? "Add, edit, or remove organization policies displayed to employees"
              : "View company policies and guidelines"}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Policy
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : isError ? (
        <Card glass>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Failed to load policies</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
          </CardContent>
        </Card>
      ) : policies.length === 0 ? (
        <Card glass>
          <CardContent className="py-12 text-center text-muted-foreground">
            {canManage
              ? 'No policies yet. Click "Add Policy" to create one.'
              : "No company policies have been published yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <Card key={policy.id} glass>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base">{policy.title}</CardTitle>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(policy)}
                        aria-label={`Edit ${policy.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remove policy "${policy.title}"?`)) {
                            deleteMutation.mutate(policy.id);
                          }
                        }}
                        aria-label={`Remove ${policy.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {!canManage && (
                  <CardDescription>Company policy</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {policy.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (open) setDialogOpen(true);
            else closeDialog();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Policy" : "Add Policy"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update this company policy"
                  : "Create a new company policy"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Policy Title</Label>
                <Input id="title" {...form.register("title")} />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Policy Content</Label>
                <Textarea id="content" rows={5} {...form.register("content")} />
                {form.formState.errors.content && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.content.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? "Update Policy" : "Save Policy"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}
