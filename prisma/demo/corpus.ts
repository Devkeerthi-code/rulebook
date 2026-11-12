/**
 * DEMO CORPUS — entirely fictional.
 * "Northfield Institute of Technology" and every rule, fee, date and name below are invented for the demo.
 * They are not the rules of any real college.
 */

export type DemoBlock = { h: string } | { p: string };

export interface DemoDocument {
  key: "handbook" | "placement" | "circular" | "hostel";
  title: string;
  type: "HANDBOOK" | "POLICY" | "CIRCULAR" | "RULES";
  effectiveDate: string;
  fileName: string;
  pages: DemoBlock[][];
}

export const DEMO_COLLEGE = {
  name: "Northfield Institute of Technology (DEMO)",
  shortName: "NIT-DEMO",
} as const;

export const DEMO_RUNNING_HEADER = "Northfield Institute of Technology - fictional DEMO document, not real rules";

const handbook: DemoDocument = {
  key: "handbook",
  title: "Student Handbook 2025-26",
  type: "HANDBOOK",
  effectiveDate: "2025-07-01",
  fileName: "Student_Handbook_2025-26_DEMO.pdf",
  pages: [
    [
      { h: "STUDENT HANDBOOK 2025-26" },
      { p: "This handbook sets out the academic rules for undergraduate students of Northfield Institute of Technology. It applies to all students on the rolls from 1 July 2025 and replaces the 2024-25 edition." },
      { p: "Where a circular issued by the Office of the Dean, Academics, after the date of this handbook changes a rule, the circular prevails over this handbook to the extent of the change." },
      { h: "How to use this handbook" },
      { p: "Sections 1 to 3 cover registration, credits and grading. Section 4 covers attendance. Sections 5 to 7 cover examinations, re-evaluation and backlogs. Section 8 covers scholarships and Section 9 covers conduct and grievances." },
    ],
    [
      { h: "Section 1: Academic calendar and registration" },
      { h: "1.1 Semesters" },
      { p: "The academic year has two semesters. The Odd Semester runs from July to November and the Even Semester from January to May. Each semester has at least 90 instructional days." },
      { h: "1.2 Course registration" },
      { p: "Every student must register for courses on the academic portal within the first five working days of each semester. A student who does not register in this period may register late within the next five working days on payment of a late fee of Rs. 1,000." },
      { p: "A student who has not registered by the end of the late registration period is not permitted to attend classes in that semester." },
      { h: "1.3 Adding and dropping courses" },
      { p: "A student may add or drop an elective course within the first two weeks of the semester with the approval of the faculty advisor. Core courses cannot be dropped." },
    ],
    [
      { h: "Section 2: Credits" },
      { h: "2.1 Credit requirement" },
      { p: "To be awarded the B.Tech degree a student must earn a minimum of 160 credits, including all core courses of the programme, within the maximum period allowed." },
      { h: "2.2 Credit load per semester" },
      { p: "A student must register for a minimum of 16 and a maximum of 26 credits in a regular semester. A student with a CGPA of 8.5 or above may register for up to 28 credits with the approval of the Head of Department." },
      { h: "2.3 Maximum period" },
      { p: "The maximum period to complete the B.Tech programme is eight years from the date of admission, or six years for students admitted directly to the second year (lateral entry)." },
    ],
    [
      { h: "Section 3: Grading" },
      { h: "3.1 Letter grades" },
      { p: "Performance in each course is awarded a letter grade with grade points as follows: O (Outstanding) 10, A+ (Excellent) 9, A (Very Good) 8, B+ (Good) 7, B (Above Average) 6, C (Average) 5, P (Pass) 4, F (Fail) 0 and AB (Absent) 0." },
      { p: "A student must secure at least 40% of the total marks in a course, and at least 35% in its end-semester examination, to obtain a pass grade." },
      { h: "3.2 SGPA and CGPA" },
      { p: "The Semester Grade Point Average (SGPA) is the credit-weighted average of grade points in the courses of a semester. The Cumulative Grade Point Average (CGPA) is the credit-weighted average over all courses passed so far. Both are calculated to two decimal places and are not rounded." },
      { h: "3.3 Conversion to percentage" },
      { p: "Where a percentage is required, it is calculated as (CGPA - 0.5) x 10. For example, a CGPA of 7.50 corresponds to 70%." },
    ],
    [
      { h: "Section 4: Attendance" },
      { h: "4.1 Minimum attendance" },
      { p: "Attendance is recorded for every scheduled lecture, tutorial and laboratory session. It is computed separately for each course registered in the semester." },
      { p: "A student must have a minimum of 75% attendance in each course to be eligible to write the end-semester examination of that course." },
      { p: "Attendance is counted from the first instructional day of the semester as notified in the academic calendar, irrespective of the date of registration." },
      { h: "4.2 On-duty leave" },
      { p: "Students representing the Institute in sports, cultural or technical events with prior written approval of the Head of Department may be granted on-duty leave, which is counted as attendance up to a maximum of 10% of the classes in a course." },
      { h: "4.3 Medical leave" },
      { p: "Medical leave must be reported to the faculty advisor within three working days of returning to class, with a certificate from a registered medical practitioner. Medical leave is not counted as attendance but may be considered for condonation under clause 4.6." },
    ],
    [
      { h: "4.6 Condonation of shortage" },
      { p: "Shortage of attendance may be condoned by the Academic Council on medical grounds or for other valid reasons, provided the attendance in the course is not less than 60%." },
      { p: "A condonation fee as notified by the Institute from time to time shall be paid. Condonation may be granted to a student a maximum of two times during the programme." },
      { h: "4.7 Detention" },
      { p: "A student whose shortage is not condoned is detained in the course, receives the grade AB, and must re-register for the course when it is next offered." },
    ],
    [
      { h: "Section 5: Examinations" },
      { h: "5.1 Assessment pattern" },
      { p: "Each theory course is assessed out of 100 marks: 40 marks of continuous internal assessment and 60 marks in the end-semester examination. Laboratory courses are assessed entirely by continuous internal assessment." },
      { h: "5.2 Hall ticket" },
      { p: "A hall ticket is issued only to students who meet the attendance requirement and have no fee dues. A student must carry the hall ticket and college identity card to every examination." },
      { h: "5.3 Malpractice" },
      { p: "Possession of a mobile phone, smartwatch or written material in the examination hall is treated as malpractice, whether or not it is used. Cases of malpractice are decided by the Examination Discipline Committee, and the penalty may include cancellation of all examinations of that semester." },
    ],
    [
      { h: "Section 6: Re-evaluation" },
      { h: "6.1 Applying for re-evaluation" },
      { p: "A student may apply for re-evaluation of an end-semester theory examination answer script within seven working days of the publication of results, through the examination portal." },
      { h: "6.2 Fees" },
      { p: "The fee is Rs. 1,000 per course for re-evaluation and Rs. 300 per course for a photocopy of the answer script." },
      { h: "6.3 Outcome" },
      { p: "If re-evaluation results in a change of 15% or more of the maximum marks, the re-evaluation fee is refunded. The re-evaluated marks, whether higher or lower, replace the original marks." },
      { h: "6.4 Exclusions" },
      { p: "Re-evaluation is not permitted for laboratory courses, project work, seminars or internship evaluations." },
    ],
    [
      { h: "Section 7: Backlogs and supplementary examinations" },
      { h: "7.1 What a backlog is" },
      { p: "A course in which a student has obtained the grade F or AB is a backlog until the student passes it." },
      { h: "7.2 Supplementary examinations" },
      { p: "Supplementary examinations for backlog courses are held in June and December each year. The fee is Rs. 750 per course. Internal assessment marks from the original attempt are carried forward." },
      { h: "7.3 Promotion to the third year" },
      { p: "A student is promoted to the third year only after earning at least 50% of the total credits prescribed for the first and second years. A student who is not promoted must clear backlogs before joining the third year." },
    ],
    [
      { h: "Section 8: Scholarships and concessions" },
      { h: "8.1 Merit scholarships" },
      { p: "Merit scholarships are awarded each year to the top 5% of students in each programme, based on the CGPA of the previous academic year, as a waiver of 50% of the tuition fee." },
      { p: "A student with a backlog or a disciplinary penalty in the previous academic year is not eligible for a merit scholarship." },
      { h: "8.2 Fee concessions" },
      { p: "Students from families with an annual income below the limit notified by the State Government may apply for a fee concession through the Accounts Section before 31 August each year." },
    ],
    [
      { h: "Section 9: Conduct and grievances" },
      { h: "9.1 Ragging" },
      { p: "Ragging in any form is a criminal offence and is banned on and off campus. A student found guilty of ragging may be suspended or expelled. Complaints can be made to the Anti-Ragging Committee at any time." },
      { h: "9.2 Identity card" },
      { p: "Students must wear their college identity card at all times on campus. A lost identity card is replaced on payment of Rs. 200." },
      { h: "9.3 Grievance redressal" },
      { p: "Academic grievances are first raised with the faculty advisor. If unresolved within ten working days, the student may appeal in writing to the Student Grievance Committee, whose decision is final." },
    ],
  ],
};

const placement: DemoDocument = {
  key: "placement",
  title: "Placement Policy 2025-26",
  type: "POLICY",
  effectiveDate: "2025-06-15",
  fileName: "Placement_Policy_2025-26_DEMO.pdf",
  pages: [
    [
      { h: "PLACEMENT POLICY 2025-26" },
      { p: "This policy governs campus placements organised by the Training and Placement Cell for the 2025-26 recruitment season. It applies to final-year B.Tech students." },
      { h: "Section 1: Registration" },
      { h: "1.1 Registering with the Cell" },
      { p: "Students must register with the Training and Placement Cell on the placement portal by 31 July 2025. A one-time registration fee of Rs. 1,500 is payable. Students who do not register cannot apply to any drive." },
      { h: "1.2 Training resources" },
      { p: "The Cell maintains a computer laboratory with 60 systems, open from 9 am to 8 pm on working days, for aptitude practice and online assessments." },
    ],
    [
      { h: "Section 2: Eligibility" },
      { h: "2.1 Eligibility to register" },
      { p: "A student is eligible to register with the Training and Placement Cell if they have a CGPA of 6.0 or above, without rounding, at the time of registration, and not more than one active backlog." },
      { h: "2.2 Active backlogs" },
      { p: "An active backlog is a course for which the student has not secured a pass grade. A backlog cleared in a supplementary examination ceases to be active from the date the results are published." },
      { h: "2.3 Company criteria" },
      { p: "Recruiting organisations may prescribe eligibility criteria stricter than the above, such as a higher CGPA or no backlogs. Such criteria, stated in the drive notification, prevail for that drive." },
    ],
    [
      { h: "Section 3: Offers" },
      { h: "3.1 One offer rule" },
      { p: "A student who has accepted one offer may apply to a further drive only if the CTC offered is at least 1.5 times that of the accepted offer." },
      { h: "3.2 Dream offers" },
      { p: "Drives with a CTC of Rs. 12 lakh per annum or more are dream drives. Any registered student may apply to a dream drive even after accepting an offer, but may hold only one dream offer." },
      { h: "3.3 Pre-placement offers" },
      { p: "A student who receives a pre-placement offer through an internship must accept or decline it within 15 days. An accepted pre-placement offer counts as an accepted offer under clause 3.1." },
    ],
    [
      { h: "Section 4: Conduct during drives" },
      { h: "4.1 Pre-placement talks" },
      { p: "Attendance at the pre-placement talk of a company is mandatory for students who have applied to that drive." },
      { h: "4.2 Absence after applying" },
      { p: "A student who applies to a drive and is absent from any round without informing the Cell in writing at least 24 hours in advance is debarred from the next two drives." },
      { h: "4.3 Dress code" },
      { p: "Students must attend interviews in formal dress and carry two printed copies of their resume and their college identity card." },
    ],
  ],
};

const circular: DemoDocument = {
  key: "circular",
  title: "Circular 07/2025: Revised attendance condonation",
  type: "CIRCULAR",
  effectiveDate: "2025-09-12",
  fileName: "Circular_07-2025_Attendance_Condonation_DEMO.pdf",
  pages: [
    [
      { h: "OFFICE OF THE DEAN, ACADEMICS" },
      { p: "Circular No. NIT/ACAD/07/2025, dated 12 September 2025." },
      { h: "Subject: Revised norms for condonation of attendance shortage" },
      { p: "In partial modification of clause 4.6 of the Student Handbook 2025-26, the Academic Council in its meeting held on 5 September 2025 has resolved as follows, with effect from the Odd Semester 2025-26:" },
      { p: "(a) Shortage of attendance may be condoned only where the attendance in the course is not less than 65%, on medical grounds supported by certificates, or for representing the Institute." },
      { p: "(b) A condonation fee of Rs. 500 per course shall be paid before the last date for submission of examination forms." },
      { p: "(c) All other provisions of clause 4.6, including the limit of two condonations during the programme, remain unchanged." },
      { p: "All students and faculty advisors are requested to take note." },
    ],
  ],
};

const hostel: DemoDocument = {
  key: "hostel",
  title: "Hostel Rules 2025",
  type: "RULES",
  effectiveDate: "2025-01-10",
  fileName: "Hostel_Rules_2025_DEMO.pdf",
  pages: [
    [
      { h: "HOSTEL RULES 2025" },
      { h: "Section 1: Timings" },
      { h: "1.1 In-time" },
      { p: "All residents must be inside the hostel by 9:30 pm. Residents returning after 9:30 pm must sign the late-entry register at the gate and inform the warden in advance." },
      { p: "Three late entries without prior permission in a semester lead to a fine of Rs. 500 and a letter to the parent or guardian." },
      { h: "1.2 Overnight leave" },
      { p: "Residents going home or staying out overnight must apply for leave on the hostel portal at least one day in advance and record the return date." },
    ],
    [
      { h: "Section 2: Rooms" },
      { h: "2.1 Room allotment" },
      { p: "Rooms are allotted at the beginning of the academic year by the Chief Warden, based on year of study and availability." },
      { h: "2.2 Change of room" },
      { p: "Requests for a change of room are considered only during the first two weeks of each semester, by written application to the warden." },
      { p: "A change of room outside this period may be permitted only on medical grounds, on the recommendation of the Institute Medical Officer and with the approval of the Chief Warden." },
      { h: "2.3 Electrical appliances" },
      { p: "Electric kettles, heaters, irons and induction stoves are not permitted in rooms. Appliances found in rooms are confiscated and a fine of Rs. 1,000 is levied." },
    ],
    [
      { h: "Section 3: Mess" },
      { h: "3.1 Mess timings" },
      { p: "Breakfast is served from 7:30 am to 9:00 am, lunch from 12:30 pm to 2:00 pm and dinner from 7:30 pm to 9:00 pm." },
      { h: "3.2 Mess rebate" },
      { p: "A resident on approved leave for four or more consecutive days is eligible for a mess rebate for the days of absence, if the leave was applied for in advance on the hostel portal." },
      { h: "Section 4: Visitors" },
      { p: "Visitors may meet residents only in the visitors' lounge between 4 pm and 7 pm. Visitors are not permitted in rooms." },
    ],
  ],
};

export const DEMO_DOCUMENTS: DemoDocument[] = [handbook, placement, circular, hostel];

/** Plain page texts for tests and fixtures (no PDF round-trip). */
export function pageTexts(doc: DemoDocument): { pageNumber: number; text: string }[] {
  return doc.pages.map((blocks, i) => ({
    pageNumber: i + 1,
    text: blocks.map((b) => ("h" in b ? b.h : b.p)).join("\n"),
  }));
}
