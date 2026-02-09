"use client";

import { useEffect, useState } from "react";
import {
  Upload,
  Book,
  FileText,
  Folder,
  GripVertical,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

// --- Types ---
type Concept = {
  id: string;
  name: string;
  description: string;
  descriptionSource?: "pdf" | "ai";
};

type Module = {
  id: string;
  title: string;
  concepts: Concept[];
};

type Lecture = {
  id: string;
  title: string;
  modules: Module[];
};

type Course = {
  id: string;
  courseName: string;
  lectures: Lecture[];
};

type UploadedConcept = {
  name: string;
  description?: string;
  definition?: {
    text?: string;
    source?: "pdf" | "ai";
  };
};

type UploadedModule = {
  title: string;
  concepts?: UploadedConcept[];
};

type LibraryItemDto = {
  courseId: string;
  data: unknown;
  createdAt?: string;
};

const isCourseLike = (value: unknown): value is Pick<Course, "courseName" | "lectures"> => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.courseName === "string" && Array.isArray(v.lectures);
};

const normalizeCourseName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export default function Sidebar() {
  const [library, setLibrary] = useState<Course[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadLibrary = async () => {
      try {
        const response = await fetch("/api/library/list");
        if (!response.ok) {
          if (!cancelled) setLibrary([]);
          return;
        }

        const json = (await response.json()) as { items?: unknown };
        const items = Array.isArray(json.items) ? (json.items as LibraryItemDto[]) : [];

        const courses: Course[] = items
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            if (typeof item.courseId !== "string") return null;
            if (!isCourseLike(item.data)) return null;
            return { ...(item.data as object), id: item.courseId } as Course;
          })
          .filter(Boolean) as Course[];

        const seen = new Set<string>();
        const deduped: Course[] = [];
        for (const course of courses) {
          const key = normalizeCourseName(course.courseName);
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(course);
        }

        if (!cancelled) setLibrary(deduped);
      } catch {
        if (!cancelled) setLibrary([]);
      }
    };

    void loadLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistCourse = async (course: Course) => {
    try {
      const response = await fetch("/api/library/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, data: course }),
      });

      if (!response.ok) {
        throw new Error("Failed to save course");
      }
    } catch (error) {
      console.error(error);
      toast.error("课程保存失败，刷新后可能会丢失");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/process-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process PDF");
      }

      const result = await response.json();
      const data = result.data; // { courseName, lectureTitle, modules }

      const generateId = () => crypto.randomUUID();
      const normalizedIncomingCourseName = normalizeCourseName(String(data.courseName ?? ""));
      const existingCourse = library.find(
        (c) => normalizeCourseName(c.courseName) === normalizedIncomingCourseName
      );
      const courseId = existingCourse?.id ?? generateId();

      const modules = Array.isArray(data.modules) ? (data.modules as UploadedModule[]) : [];
      const modulesWithIds: Module[] = modules.map((m) => ({
        id: generateId(),
        title: m.title,
        concepts: (Array.isArray(m.concepts) ? m.concepts : []).map((c) => ({
          id: generateId(),
          name: c.name,
          description: c.definition?.text ?? c.description ?? "",
          descriptionSource: c.definition?.source ?? "ai",
        })),
      }));

      const newLecture: Lecture = {
        id: generateId(),
        title: data.lectureTitle,
        modules: modulesWithIds,
      };

      const updatedCourse: Course = existingCourse
        ? { ...existingCourse, lectures: [...existingCourse.lectures, newLecture] }
        : { id: courseId, courseName: data.courseName, lectures: [newLecture] };

      setLibrary((prev) => {
        const byIdIndex = prev.findIndex((c) => c.id === courseId);
        if (byIdIndex >= 0) {
          const next = [...prev];
          next[byIdIndex] = updatedCourse;
          return next;
        }

        const byNameIndex = prev.findIndex(
          (c) => normalizeCourseName(c.courseName) === normalizedIncomingCourseName
        );
        if (byNameIndex >= 0) {
          const next = [...prev];
          next[byNameIndex] = updatedCourse;
          return next;
        }

        return [...prev, updatedCourse];
      });

      await persistCourse(updatedCourse);

      toast.success("PDF processed and added to library");
    } catch (error) {
      console.error(error);
      toast.error("Failed to process PDF");
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = "";
    }
  };

  const onDragStart = (
    event: React.DragEvent,
    type: "course" | "lecture" | "module" | "concept",
    data: Course | Lecture | Module | Concept
  ) => {
    let label = "";
    let description = "";
    let descriptionSource: "pdf" | "ai" = "ai";

    switch (type) {
      case "course":
        label = (data as Course).courseName;
        break;
      case "lecture":
      case "module":
        label = (data as Lecture | Module).title;
        break;
      case "concept":
        label = (data as Concept).name;
        description = (data as Concept).description ?? "";
        descriptionSource = (data as Concept).descriptionSource ?? "ai";
        break;
    }

    const payload = JSON.stringify({ type, data: { label, description, descriptionSource } });
    event.dataTransfer.setData("application/reactflow", payload);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="w-80 h-full bg-white border-r flex flex-col shadow-sm z-20">
      {/* Header & Upload */}
      <div className="p-4 border-b space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Unigraph Library</h1>
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isUploading}
          />
          <Button className="w-full" disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Lecture PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Library Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Layer 1: Course (Accordion Single) */}
        <Accordion type="single" collapsible className="space-y-2">
          {library.map((course) => (
            <AccordionItem
              key={course.id}
              value={course.id}
              className="border rounded-lg overflow-hidden"
            >
              <div
                draggable
                onDragStart={(e) => onDragStart(e, "course", course)}
                className="cursor-grab active:cursor-grabbing"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-2">
                    <Book className="h-4 w-4" />
                    <span className="font-bold text-sm text-left">
                      {course.courseName}
                    </span>
                  </div>
                </AccordionTrigger>
              </div>
              <AccordionContent className="bg-slate-50">
                {/* Layer 2: Lecture (Nested Accordion Multiple) */}
                <Accordion type="multiple" className="w-full">
                  {course.lectures.map((lecture) => (
                    <AccordionItem
                      key={lecture.id}
                      value={lecture.id}
                      className="border-b last:border-0"
                    >
                      <div
                        draggable
                        onDragStart={(e) => onDragStart(e, "lecture", lecture)}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-slate-100 pl-4 border-l-4 border-transparent hover:border-slate-300 transition-all">
                          <div className="flex items-center gap-2 text-slate-700">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium text-left">
                              {lecture.title}
                            </span>
                          </div>
                        </AccordionTrigger>
                      </div>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="space-y-4">
                          {lecture.modules.map((module) => (
                            <div
                              key={module.id}
                              className="group relative"
                            >
                              {/* Layer 3: Module Header */}
                              <div
                                className="flex items-center gap-2 px-4 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider pl-8 border-l border-slate-200 ml-4 mb-1 cursor-grab active:cursor-grabbing hover:text-slate-800 transition-colors"
                                draggable
                                onDragStart={(e) => onDragStart(e, "module", module)}
                              >
                                <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity absolute left-2" />
                                <Folder className="h-3 w-3" />
                                {module.title}
                              </div>

                              {/* Layer 4: Concepts List */}
                              <div className="space-y-1 pl-12 border-l border-slate-200 ml-4">
                                {module.concepts.map((concept) => (
                                  <div
                                    key={concept.id}
                                    className="group/concept flex items-center gap-2 py-1 px-2 rounded hover:bg-white hover:shadow-sm cursor-grab active:cursor-grabbing text-sm text-slate-600 transition-all border border-transparent hover:border-slate-200"
                                    draggable
                                    onDragStart={(e) => onDragStart(e, "concept", concept)}
                                  >
                                    <GripVertical className="h-3 w-3 text-slate-300 opacity-0 group-hover/concept:opacity-100 transition-opacity" />
                                    <span>{concept.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="border-t p-4">
        <SignedIn>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-700">账号</div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="redirect" forceRedirectUrl="/">
            <Button className="w-full">开始使用</Button>
          </SignInButton>
        </SignedOut>
      </div>
    </aside>
  );
}
