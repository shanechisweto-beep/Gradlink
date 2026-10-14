import type { Application, InterviewPolicy, Skill, StudentTrack, Task } from "./types";

export type AccountUser = {
  id: string;
  email: string;
  role: "student" | "company" | "admin";
  name: string;
  school: string | null;
  location: string | null;
  studyField: Skill | null;
  track: StudentTrack | null;
};

export type StudentProfile = {
  name: string;
  school: string;
  location: string;
  studyField: Skill;
  track: StudentTrack;
};

export type Certificate = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
};

export type BootstrapData = {
  user: AccountUser | null;
  tasks: Task[];
  applications: Application[];
  policy: InterviewPolicy;
  profile: StudentProfile | null;
  companyName: string | null;
  certificates: Certificate[];
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch (error) {
      console.error("Could not read the API error response", error);
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Could not encode ${file.name}`));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
