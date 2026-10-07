export const SKILL_OPTIONS = [
  "Design",
  "Excel",
  "Coding",
  "Writing",
  "Translation",
  "Marketing",
  "Data Analysis",
  "Research",
  "UX/UI",
  "Product Management",
  "Social Media",
  "Branding",
  "Business Strategy",
  "Content Creation",
  "Sales",
  "HR",
  "Finance",
  "Operations",
  "Project Management",
  "Web Development",
  "Mobile Development",
  "AI/ML",
  "Photography",
  "Video Editing",
  "Customer Support",
  "Data Entry",
  "ERP",
  "SEO",
  "Copywriting",
  "Illustration",
  "Administration",
  "Quality Assurance",
  "Cybersecurity"
] as const;

export type Skill = (typeof SKILL_OPTIONS)[number];
export type WorkLevel = "Entry level" | "Intermediate" | "Professional" | "Advanced";
export type StudentTrack = "earning" | "interview";
export type InterviewPolicy = {
  studentCompletedTasks: number;
  companyFilledTasks: number;
  minimumInterviewInvites: number;
};

export type Task = {
  id: string;
  company: string;
  title: string;
  description: string;
  budget: number;
  payment: "USD" | "EcoCash";
  skill: Skill;
  level: WorkLevel;
  deadline: string;
  applicants: number;
  match: number;
  rating: number;
  verified: boolean;
  mine?: boolean;
};

export type Application = {
  id: string;
  taskId: string;
  studentId: string;
  studentName: string;
  studentTrack: StudentTrack;
  studentStudyField: Skill;
  proposal: string;
  deliveryDays: number;
  portfolio: string;
  createdAt: string;
  status: "applied" | "accepted" | "rejected" | "completed" | "interview-invited";
  interviewInvited?: boolean;
};