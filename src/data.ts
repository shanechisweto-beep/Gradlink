import type { Application, Skill, Task } from "./types";

export const seedTasks: Task[] = [
  {
    id: "t1", company: "Tariro Pharmacy", title: "Design a professional price list",
    description: "Create a clean pharmacy price list that staff can update easily. Use Excel with clear categories, prices and automatic markup calculations.",
    budget: 30, payment: "USD", skill: "Excel", level: "Intermediate", deadline: "18h left", applicants: 5, match: 92, rating: 4.8, verified: true
  },
  {
    id: "t2", company: "Gateway Church Mabelreign", title: "Build a WhatsApp bot for church",
    description: "Build a simple WhatsApp-style bot flow for announcements, service times and frequently asked questions. Keep the conversation easy for members to use.",
    budget: 15, payment: "EcoCash", skill: "Coding", level: "Entry level", deadline: "1d left", applicants: 2, match: 81, rating: 4.6, verified: true
  },
  {
    id: "t3", company: "Rudo M. • UZ", title: "Type and format my dissertation",
    description: "Type and professionally format an 80-page University of Zimbabwe dissertation. Apply consistent headings, page numbering, tables and references.",
    budget: 50, payment: "USD", skill: "Writing", level: "Professional", deadline: "2d left", applicants: 1, match: 76, rating: 4.9, verified: true
  },
  {
    id: "t4", company: "Mbare Youth Trust", title: "Translate a Shona health flyer",
    description: "Translate a short health-awareness flyer from English into natural, easy-to-understand Shona while preserving the intended meaning and tone.",
    budget: 20, payment: "USD", skill: "Translation", level: "Intermediate", deadline: "20h left", applicants: 2, match: 88, rating: 4.7, verified: true
  },
  {
    id: "t5", company: "Kudzi's Kitchen", title: "Design a modern menu board",
    description: "Create a clean digital menu board for a growing Harare food business. The design should work for WhatsApp sharing and social media.",
    budget: 25, payment: "USD", skill: "Design", level: "Entry level", deadline: "1d left", applicants: 4, match: 90, rating: 4.8, verified: true
  },
  {
    id: "t6", company: "Chinhoyi Agro Supplies", title: "Build an Excel stock tracker",
    description: "Create an easy stock sheet with product quantities, reorder warnings and simple totals for a small agricultural supplies shop.",
    budget: 35, payment: "EcoCash", skill: "Excel", level: "Advanced", deadline: "3d left", applicants: 3, match: 86, rating: 4.5, verified: true
  },
  {
    id: "t7", company: "ZimRide Shuttles", title: "Fix our React booking page",
    description: "Debug a small React booking interface and fix the form validation and mobile layout. Existing code will be supplied to the selected student.",
    budget: 40, payment: "USD", skill: "Coding", level: "Professional", deadline: "2d left", applicants: 5, match: 94, rating: 4.9, verified: true
  },
  {
    id: "t8", company: "Bulawayo Arts Festival", title: "Create a festival poster series",
    description: "Design three coordinated promotional posters for a student-friendly arts event in Bulawayo. Final files should be ready for digital sharing.",
    budget: 45, payment: "USD", skill: "Design", level: "Advanced", deadline: "4d left", applicants: 6, match: 89, rating: 4.8, verified: true
  }
];

export const seedApplications: Application[] = Array.from({length: 12}, (_, i) => ({
  id: `a${i + 1}`, taskId: seedTasks[i % seedTasks.length].id,
  studentId: `seed-student-${i % 3}`,
  studentName: ["Ruth Ndlovu", "Simba Chitepo", "Elena Dube"][i % 3],
  studentTrack: "earning",
  studentStudyField: (["Coding", "Design", "Writing"] as Skill[])[i % 3],
  proposal: "I can complete this carefully and deliver a polished result.",
  deliveryDays: (i % 3) + 1, portfolio: "", createdAt: new Date().toISOString(),
  status: "completed"
}));