"use client";

import { useSession } from "@hrms/lib/hrms-session";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FolderOpen, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@hrms/components/ui/button";
import { Skeleton } from "@hrms/components/ui/skeleton";
import { Badge } from "@hrms/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hrms/components/ui/card";
import { apiFetchArray } from "@hrms/lib/client-api";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatFileSize,
} from "@hrms/lib/employee-documents";
import type { EmployeeDocumentCategory } from "@prisma/hrms-client";

interface EmployeeDocument {
  id: string;
  title: string;
  category: EmployeeDocumentCategory;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

export default function MyDocumentsPage() {
  const { data: session, status } = useSession();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["my-documents"],
    queryFn: () => apiFetchArray<EmployeeDocument>("/api/employee-documents"),
    enabled: status === "authenticated",
  });

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl"
    >
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink flex items-center gap-2">
          <FolderOpen className="h-7 w-7 text-brand-600" />
          My Documents
        </h1>
        <p className="text-muted-foreground mt-1">
          Appraisal letters, undertakings, and other documents shared with you
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : documents.length === 0 ? (
        <Card glass>
          <CardContent className="py-12 text-center text-muted-foreground">
            No documents have been uploaded for you yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} glass>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{doc.title}</CardTitle>
                    <CardDescription className="mt-1">
                      Uploaded {format(new Date(doc.createdAt), "dd MMM yyyy")}
                      {" · "}
                      {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {DOCUMENT_CATEGORY_LABELS[doc.category]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  <p>{doc.fileName}</p>
                  <p className="text-xs">{formatFileSize(doc.fileSize)}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
