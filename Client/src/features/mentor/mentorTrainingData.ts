export interface QuizQuestion {
  id: string;
  question: string;
  scenario?: string;
  options: {
    id: string;
    text: string;
  }[];
  correctOptionId: string;
  explanation: string;
}

export interface TrainingModule {
  id: string;
  quizId: string;
  title: string;
  shortDescription: string;
  category: string;
  points: number;
  estimatedMinutes: number;
  overview: string[];
  keyTakeaways: string[];
  questions: QuizQuestion[];
}

export const MENTOR_TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'module_framework_basics',
    quizId: 'quiz_framework_basics',
    title: 'ProMove Innovation Framework & Stage Gates',
    shortDescription: 'Master the 5-stage innovation lifecycle from Problem Bank claiming to Startup Launch.',
    category: 'Framework & Lifecycle',
    points: 15,
    estimatedMinutes: 5,
    overview: [
      'Understand how students discover real-world problem statements across 8 industry sectors in the Problem Bank.',
      'Learn the 5 progressive stages: Idea Selection → Problem Claiming → Build (Prototype/MVP) → Patent Filing → Startup Launch.',
      'Guide students to build verifiable evidence at each stage gate to unlock their Innovation Score.',
    ],
    keyTakeaways: [
      'Innovation Score is awarded on verified milestone completions, not theoretical ideas.',
      'Students must claim a problem before submitting prototype evidence.',
      'Stage progression requires mentor review or automated verification checks.',
    ],
    questions: [
      {
        id: 'q1_1',
        question: 'What is the correct sequence of stages in the ProMove student innovation lifecycle?',
        options: [
          { id: 'a', text: 'Startup Launch → Patent Filing → Problem Claiming → Build' },
          { id: 'b', text: 'Idea Selection → Problem Claiming → Build (MVP) → Patent Filing → Startup Launch' },
          { id: 'c', text: 'Patent Filing → Equity LOI → Problem Claiming → Graduation' },
          { id: 'd', text: 'Build → Funding → Problem Selection → Patent Filing' },
        ],
        correctOptionId: 'b',
        explanation: 'ProMove follows a structured pipeline: Idea Selection → Problem Claiming → Build (MVP) → Patent Filing → Startup Launch.',
      },
      {
        id: 'q1_2',
        question: 'How do students claim problem statements on ProMove?',
        options: [
          { id: 'a', text: 'By submitting a direct request on the Problem Bank from 8 curated industry sectors' },
          { id: 'b', text: 'By paying an upfront fee to the college administration' },
          { id: 'c', text: 'By waiting for a recruiter to assign them a task' },
          { id: 'd', text: 'Through random automatic allocation only' },
        ],
        correctOptionId: 'a',
        explanation: 'Students explore and claim curated industry problem statements across 8 domains directly in the Problem Bank.',
      },
      {
        id: 'q1_3',
        question: 'What happens when a student reaches the Prototype (Build) stage gate?',
        options: [
          { id: 'a', text: 'They automatically graduate without further reviews' },
          { id: 'b', text: 'The mentor validates their working MVP, triggering a prototype velocity score event' },
          { id: 'c', text: 'Their account is locked until an investor buys equity' },
          { id: 'd', text: 'All previous innovation points are reset' },
        ],
        correctOptionId: 'b',
        explanation: 'Reaching and verifying prototype velocity proves real execution and awards points to both the student and mentor.',
      },
      {
        id: 'q1_4',
        question: 'Why is the Innovation Score important for students on ProMove?',
        options: [
          { id: 'a', text: 'It is solely an internal college grading metric' },
          { id: 'b', text: 'It acts as verified proof-of-work that attracts recruiters, startups, and investors' },
          { id: 'c', text: 'It can be exchanged for cryptocurrency' },
          { id: 'd', text: 'It only measures attendance in offline classes' },
        ],
        correctOptionId: 'b',
        explanation: 'The Innovation Score serves as verified proof of skills, creativity, and project velocity for hiring and investment.',
      },
    ],
  },
  {
    id: 'module_prototype_verification',
    quizId: 'quiz_prototype_verification',
    title: 'Prototype & Lab Evidence Verification',
    shortDescription: 'Learn how to inspect maker-lab hardware, code repositories, and demo proof.',
    category: 'Technical Validation',
    points: 15,
    estimatedMinutes: 5,
    overview: [
      'Understand evidence verification criteria for maker-lab hardware and IoT development kits.',
      'Learn how to inspect code repositories, live demo URLs, and hardware photos in the Evidence Center.',
      'Avoid common verification pitfalls such as approving stock images or unverified generic claims.',
    ],
    keyTakeaways: [
      'Hardware sync requires clear photos of the lab kit and project setup.',
      'Software submissions should include demonstrable code and functional previews.',
      'Approving verified milestones unlocks institutional incubation metrics.',
    ],
    questions: [
      {
        id: 'q2_1',
        question: 'What is required when submitting a Lab Hardware Sync task in the Evidence Center?',
        options: [
          { id: 'a', text: 'Only a verbal confirmation from the student' },
          { id: 'b', text: 'Clear photos of the hardware setup, kit description, and the lab session date' },
          { id: 'c', text: 'A commercial receipt from an electronics store' },
          { id: 'd', text: 'A patent application receipt' },
        ],
        correctOptionId: 'b',
        explanation: 'Lab Hardware Sync requires verified photos, detailed kit descriptions, and accurate dates for admin validation.',
      },
      {
        id: 'q2_2',
        question: 'When reviewing a student software prototype, what constitutes valid evidence?',
        options: [
          { id: 'a', text: 'A single PowerPoint slide with a concept mock' },
          { id: 'b', text: 'A working demo URL, testable repository commits, or recorded walkthrough video' },
          { id: 'c', text: 'An idea description without any implementation' },
          { id: 'd', text: 'A competitor website screenshot' },
        ],
        correctOptionId: 'b',
        explanation: 'Working demos, accessible repositories, and functional video walkthroughs verify real implementation.',
      },
      {
        id: 'q2_3',
        question: 'How does Prototype Velocity (+100 pts cap) benefit the mentor in Phase 2?',
        options: [
          { id: 'a', text: 'Mentors earn +10 pts for each student guided successfully to the prototype stage' },
          { id: 'b', text: 'It transfers 100% of the student equity to the mentor' },
          { id: 'c', text: 'It exempts the mentor from all future training' },
          { id: 'd', text: 'It replaces all other Phase 1 requirements' },
        ],
        correctOptionId: 'a',
        explanation: 'Mentors earn +10 points per prototype transition (up to 100 pts) as part of their Phase 2 incubation metrics.',
      },
      {
        id: 'q2_4',
        question: 'What should a mentor do if a student submission contains incomplete or copied evidence?',
        options: [
          { id: 'a', text: 'Approve it anyway to help the student' },
          { id: 'b', text: 'Provide constructive feedback, reject/request revisions, and guide them to improve' },
          { id: 'c', text: 'Delete the student account permanently without notice' },
          { id: 'd', text: 'Ignore the submission indefinitely' },
        ],
        correctOptionId: 'b',
        explanation: 'Mentors maintain platform integrity by guiding students with constructive feedback and requesting necessary revisions.',
      },
    ],
  },
  {
    id: 'module_patent_guidance',
    quizId: 'quiz_patent_guidance',
    title: 'IP, Patent Filing & Prior Art Basics',
    shortDescription: 'Guide student inventors through prior art search, novel claims, and patent filing pathways.',
    category: 'Intellectual Property',
    points: 15,
    estimatedMinutes: 5,
    overview: [
      'Learn the fundamentals of novelty, inventive step, and industrial applicability for student innovations.',
      'Understand how to guide students through prior art searches before filing patent drafts.',
      'Identify the difference between Provisional Specifications and Complete Specifications.',
    ],
    keyTakeaways: [
      'Prior art searches prevent filing already-patented or obvious concepts.',
      'Provisional applications secure an early priority date while students build their MVP.',
      'Student inventors retain their inventorship rights under institutional guidelines.',
    ],
    questions: [
      {
        id: 'q3_1',
        question: 'What are the three fundamental criteria for patentability of a student invention?',
        options: [
          { id: 'a', text: 'Popularity, high price, and marketing budget' },
          { id: 'b', text: 'Novelty, Inventive Step (Non-obviousness), and Industrial Applicability' },
          { id: 'c', text: 'Social media followers, website design, and logo quality' },
          { id: 'd', text: 'College endorsement, minimum age, and team size' },
        ],
        correctOptionId: 'b',
        explanation: 'Patents require novelty (new invention), non-obviousness (inventive step), and industrial applicability (practical utility).',
      },
      {
        id: 'q3_2',
        question: 'What is the primary purpose of conducting a Prior Art search before drafting a patent?',
        options: [
          { id: 'a', text: 'To copy existing patents word-for-word' },
          { id: 'b', text: 'To verify that the invention is truly novel and does not infringe existing published patents' },
          { id: 'c', text: 'To find investors willing to buy the company' },
          { id: 'd', text: 'To avoid writing any technical descriptions' },
        ],
        correctOptionId: 'b',
        explanation: 'Prior art searches ensure novelty and help identify existing solutions to clearly define the new inventive aspects.',
      },
      {
        id: 'q3_3',
        question: 'Why would a student team file a Provisional Patent Specification first?',
        options: [
          { id: 'a', text: 'To lock in an early Priority Date while refining their prototype over the next 12 months' },
          { id: 'b', text: 'Because provisional patents never require a complete specification' },
          { id: 'c', text: 'It is a requirement for opening a college bank account' },
          { id: 'd', text: 'To bypass all examination requirements forever' },
        ],
        correctOptionId: 'a',
        explanation: 'A provisional filing secures the official priority date and provides 12 months to complete testing and file the complete specification.',
      },
      {
        id: 'q3_4',
        question: 'Who should be listed as inventors on a patent resulting from student project work?',
        options: [
          { id: 'a', text: 'Only the college principal regardless of contribution' },
          { id: 'b', text: 'The actual individuals who made intellectual/inventive contributions to the invention' },
          { id: 'c', text: 'Any student who attended the college during that semester' },
          { id: 'd', text: 'External sponsors who only provided funding without technical input' },
        ],
        correctOptionId: 'b',
        explanation: 'Inventorship is a legal right belonging specifically to the individuals who contributed to the conception of the invention.',
      },
    ],
  },
  {
    id: 'module_mentorship_ethics',
    quizId: 'quiz_mentorship_ethics',
    title: 'Mentorship Ethics & Session Standards',
    shortDescription: 'Best practices for 1-on-1 sessions, session token releases, and student safety.',
    category: 'Pedagogy & Ethics',
    points: 15,
    estimatedMinutes: 5,
    overview: [
      'Learn how to conduct high-impact 1-on-1 mentorship and cohort sessions on ProMove.',
      'Understand the session token release mechanism (where students verify session value).',
      'Follow ethical guidelines for equity negotiations, startup advisory, and respectful communication.',
    ],
    keyTakeaways: [
      'Session points are released when students confirm session completion and provide ratings.',
      'Mentors must maintain a supportive, inclusive, and professional environment at all times.',
      'Equity LOIs must be transparent and aligned with standard platform incubation guidelines.',
    ],
    questions: [
      {
        id: 'q4_1',
        question: 'How are Mentor Score points released for 1-on-1 mentoring sessions?',
        options: [
          { id: 'a', text: 'Automatically without attending the call' },
          { id: 'b', text: 'When the student verifies session completion and releases the session token (+10 pts per 30 min)' },
          { id: 'c', text: 'By paying an administrative fee' },
          { id: 'd', text: 'Points are only awarded if the startup raises $1M' },
        ],
        correctOptionId: 'b',
        explanation: 'Session points (+10 pts per 30 min) are unlocked when the mentee confirms the session in their dashboard.',
      },
      {
        id: 'q4_2',
        question: 'What is the recommended approach for providing critical code or design reviews to students?',
        options: [
          { id: 'a', text: 'Harshly pointing out mistakes in public forums' },
          { id: 'b', text: 'Offering constructive, actionable feedback with specific code examples and learning resources' },
          { id: 'c', text: 'Rewriting the entire project yourself without explaining anything' },
          { id: 'd', text: 'Refusing to review any code that is not 100% bug-free' },
        ],
        correctOptionId: 'b',
        explanation: 'Effective mentorship emphasizes constructive feedback, actionable improvements, and empowering the student to solve problems.',
      },
      {
        id: 'q4_3',
        question: 'When advising a student startup on Equity Letters of Intent (LOI), what is the mentor’s responsibility?',
        options: [
          { id: 'a', text: 'Demanding the maximum possible equity share regardless of contribution' },
          { id: 'b', text: 'Ensuring fair, transparent terms that protect the student founders while providing clear advisory value' },
          { id: 'c', text: 'Preventing the student from talking to any other mentors or investors' },
          { id: 'd', text: 'Forcing the student to sign without legal review' },
        ],
        correctOptionId: 'b',
        explanation: 'Mentors must act in good faith with fair, transparent terms that support the startup long-term.',
      },
      {
        id: 'q4_4',
        question: 'How does answering questions on the technical forum contribute to your Mentor Score?',
        options: [
          { id: 'a', text: 'Helpful answers earn +5 pts, and answers verified as solutions earn +15 pts' },
          { id: 'b', text: 'Forum answers only award points to students, not mentors' },
          { id: 'c', text: 'Every posted word earns 1 point' },
          { id: 'd', text: 'It only counts if you have over 10,000 posts' },
        ],
        correctOptionId: 'a',
        explanation: 'Phase 3 rewards mentors for community impact with +5 pts for helpful votes and +15 pts for verified solutions.',
      },
    ],
  },
];
