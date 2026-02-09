"use client";

import { useState } from "react";
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

// --- Types ---
type Concept = {
  id: string;
  name: string;
  description: string;
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

// --- Mock Data with IDs ---
const initialLibrary: Course[] = [
  {
    id: "course-1",
    courseName: "Physics 101",
    lectures: [
      {
        id: "lecture-1-1",
        title: "Lecture 1: Kinematics",
        modules: [
          {
            id: "module-1-1-1",
            title: "Motion in 1D",
            concepts: [
              { id: "concept-1-1-1-1", name: "Velocity", description: "Rate of change of position" },
              { id: "concept-1-1-1-2", name: "Acceleration", description: "Rate of change of velocity" },
            ],
          },
          {
            id: "module-1-1-2",
            title: "Newton's Laws",
            concepts: [
              { id: "concept-1-1-2-1", name: "First Law", description: "Inertia" },
              { id: "concept-1-1-2-2", name: "Second Law", description: "F=ma" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "course-2",
    courseName: "Computer Science",
    lectures: [
      {
        id: "lecture-2-1",
        title: "Lecture 3: Algorithms",
        modules: [
          {
            id: "module-2-1-1",
            title: "Sorting",
            concepts: [
              { id: "concept-2-1-1-1", name: "Bubble Sort", description: "Simple comparison sort" },
              { id: "concept-2-1-1-2", name: "Quick Sort", description: "Divide and conquer" },
            ],
          },
        ],
      },
    ],
  },
];

export default function Sidebar() {
  const [library, setLibrary] = useState<Course[]>(initialLibrary);
  const [isUploading, setIsUploading] = useState(false);

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

      // Update Library State
      setLibrary((prev) => {
        const newLibrary = [...prev];
        const existingCourseIndex = newLibrary.findIndex(
          (c) => c.courseName === data.courseName
        );

        // Helper to generate simple ID
        const generateId = () => Math.random().toString(36).substr(2, 9);

        // Process modules to add IDs
        const modulesWithIds = (data.modules || []).map((m: any) => ({
          ...m,
          id: generateId(),
          concepts: (m.concepts || []).map((c: any) => ({
            ...c,
            id: generateId(),
          })),
        }));

        const newLecture: Lecture = {
          id: generateId(),
          title: data.lectureTitle,
          modules: modulesWithIds,
        };

        if (existingCourseIndex >= 0) {
          // Add lecture to existing course
          newLibrary[existingCourseIndex].lectures.push(newLecture);
        } else {
          // Create new course
          newLibrary.push({
            id: generateId(),
            courseName: data.courseName,
            lectures: [newLecture],
          });
        }
        return newLibrary;
      });

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
    data: any
  ) => {
    // Unify label field for all types
    let unifiedData = { ...data };
    
    switch (type) {
      case 'course':
        unifiedData.label = data.courseName;
        break;
      case 'lecture':
      case 'module':
        unifiedData.label = data.title;
        break;
      case 'concept':
        unifiedData.label = data.name;
        break;
    }

    // Pass full object with type and unified label
    const payload = JSON.stringify({ type, data: unifiedData });
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
    </aside>
  );
}
