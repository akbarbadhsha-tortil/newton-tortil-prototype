/* =====================================================================
   Tortil application forms - single source of truth (PROPOSED)

   Defines the four Newton Cinema journeys rendered by app.js. The same
   definitions generate the FORMS spec in the project handoff docs,
   so field specs and prototype can't drift apart.

   Field keys
     name, type, label, required, help, placeholder, example
     type: text | email | url | number | date | textarea | select | radio
           | checkboxes | file | repeater | info
     options       [{value,label}] (select/radio/checkboxes)
     optionsBy     {field, map:{value:[options]}}   dependent options
     other         true -> adds "Other" option + "please specify" text
     maxWords / maxLength / min / max
     accept, maxMB, maxFiles                          (file)
     showIf        {field, in:[...]} | {field, notIn:[...]} | {field, filled:true}
     requiredIf    same shape as showIf
     invalidIf     {in:[...], message}               blocks progress
     note          {in:[...], text}                  informational callout
     private       true -> restricted to reviewers (DB note)
   ===================================================================== */
(function () {
  'use strict';

  function opts(list) {
    return list.map(function (o) {
      return typeof o === 'string' ? { value: o.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label: o } : o;
    });
  }

  var COUNTRIES = opts(['India', 'Sri Lanka', 'United States', 'United Kingdom', 'Canada', 'Australia', 'United Arab Emirates', 'Singapore']);
  var OFFICES = opts(['Los Angeles', 'San Francisco', 'Boston', 'Mumbai', 'Kochi', 'Colombo', 'Anywhere / flexible']);
  var LANGUAGES = opts(['English', 'Hindi', 'Malayalam', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali', 'Sinhala', 'Spanish']);
  var GENRES = opts(['Drama', 'Comedy', 'Thriller', 'Action', 'Romance', 'Horror', 'Science fiction', 'Fantasy', 'Crime', 'Mystery', 'Family', 'Biographical', 'Historical', 'Musical', 'Documentary']);
  var YES_NO_UNSURE = opts([{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'not_sure', label: 'Not sure' }]);
  var AVAILABILITY = opts([
    { value: 'now', label: 'Available now' },
    { value: 'from_date', label: 'Available from a specific date' },
    { value: 'limited', label: 'Limited availability' }
  ]);

  var ACCOUNT = { type: 'account', name: '_account' }; // prefilled card from Tortil account

  var location = [
    { name: 'country', type: 'select', label: 'Country', required: true, options: COUNTRIES, other: true, half: true },
    { name: 'city', type: 'text', label: 'City', required: true, placeholder: 'e.g. Kochi', half: true, maxLength: 80 }
  ];

  /* ------------------------------------------------------------------
     01  NEW PROJECT
     ------------------------------------------------------------------ */
  var PROJECT_LATE_STAGES = ['screenplay', 'pre_production', 'in_production'];

  var new_project = {
    id: 'new_project',
    code: 'PRJ',
    card: '01',
    cardLabel: 'Start a New Project',
    title: 'Submit a Project to Newton Cinema',
    intro: 'Share your story with Newton Cinema’s development team. Early ideas are welcome — you don’t need a budget, a crew or a finished screenplay to submit.',
    steps: [
      {
        id: 'about', title: 'About You',
        intro: 'Tell us who you are. Details from your Tortil account are filled in for you.',
        fields: [ACCOUNT].concat(location, [
          { name: 'role', type: 'radio', label: 'Your role', required: true, options: opts(['Writer', 'Director', 'Producer', 'Filmmaker']), other: true },
          { name: 'company', type: 'text', label: 'Company or production house', help: 'Leave blank if you’re submitting independently.', maxLength: 120 },
          { name: 'portfolio_url', type: 'url', label: 'Portfolio or professional website', placeholder: 'https://' }
        ])
      },
      {
        id: 'project', title: 'Project Details',
        intro: 'The essentials of your project.',
        fields: [
          { name: 'project_title', type: 'text', label: 'Project title', required: true, maxLength: 120 },
          { name: 'working_title', type: 'text', label: 'Working title', help: 'If it’s different from the title above.', maxLength: 120 },
          { name: 'project_type', type: 'select', label: 'Project type', required: true, options: opts(['Feature film', 'Short film', 'Web series', 'Documentary', 'Animation']), other: true, half: true },
          { name: 'original_language', type: 'select', label: 'Original language', required: true, options: LANGUAGES, other: true, half: true },
          { name: 'primary_genre', type: 'select', label: 'Primary genre', required: true, options: GENRES, half: true },
          { name: 'secondary_genre', type: 'select', label: 'Secondary genre', options: GENRES, half: true },
          { name: 'target_audience', type: 'text', label: 'Target audience', example: 'e.g. Young adults who enjoy coming-of-age dramas', maxLength: 160 },
          { name: 'development_stage', type: 'radio', label: 'Current development stage', required: true, options: [
            { value: 'idea', label: 'Just an idea' },
            { value: 'outline', label: 'Story outline' },
            { value: 'treatment', label: 'Treatment' },
            { value: 'screenplay', label: 'Completed screenplay' },
            { value: 'pre_production', label: 'Pre-production' },
            { value: 'in_production', label: 'Project already in production' }
          ] }
        ]
      },
      {
        id: 'story', title: 'Story',
        intro: 'Help us understand your story. Write naturally — a clear idea matters more than polish.',
        fields: [
          { name: 'logline', type: 'textarea', label: 'Logline', required: true, maxWords: 50, rows: 2, help: 'One or two sentences that capture the story.', example: 'e.g. A retired fisherman in Kochi must team up with his estranged daughter to save the harbour that raised them.' },
          { name: 'synopsis', type: 'textarea', label: 'Short synopsis', required: true, maxWords: 500, rows: 8, help: 'Aim for 300–500 words: the beginning, middle and end of the story.' },
          { name: 'synopsis_extended', type: 'textarea', label: 'Extended synopsis', maxWords: 2000, rows: 6, help: 'Optional. You can also upload a document in the next steps.' },
          { name: 'usp', type: 'textarea', label: 'What makes this story unique?', maxWords: 100, rows: 3 },
          { name: 'why_newton', type: 'textarea', label: 'Why would you like Newton Cinema to consider this project?', required: true, maxWords: 200, rows: 4 },
          { name: 'share_production', type: 'radio', label: 'Would you like to share production plans?', help: 'Choose “Yes” to add budget, location or team details.',
            options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'Not now' }],
            showIf: { field: 'development_stage', in: ['idea', 'outline', 'treatment'] } }
        ]
      },
      {
        id: 'production', title: 'Production',
        intro: 'All questions on this step are optional.',
        // Advanced questions only once the project is far enough along (or by choice)
        showIf: { any: [{ field: 'development_stage', in: PROJECT_LATE_STAGES }, { field: 'share_production', in: ['yes'] }] },
        fields: [
          { name: 'support_sought', type: 'checkboxes', label: 'What are you looking for?', options: opts(['Producer', 'Co-producer', 'Financing', 'Production support']) },
          { name: 'budget_range', type: 'select', label: 'Estimated budget range', half: true, help: 'In US dollars, approximate.', options: [
            { value: 'under_50k', label: 'Under $50,000' }, { value: '50k_250k', label: '$50,000 – $250,000' },
            { value: '250k_1m', label: '$250,000 – $1 million' }, { value: '1m_5m', label: '$1 – 5 million' },
            { value: 'over_5m', label: 'Over $5 million' }, { value: 'not_sure', label: 'Not sure yet' }] },
          { name: 'timeline', type: 'select', label: 'Proposed timeline', half: true, options: [
            { value: 'lt_6m', label: 'Within 6 months' }, { value: '6_12m', label: '6–12 months' },
            { value: '1_2y', label: '1–2 years' }, { value: 'undecided', label: 'Not decided' }] },
          { name: 'filming_location', type: 'text', label: 'Preferred filming location', maxLength: 120, example: 'e.g. Kerala backwaters, Colombo' },
          { name: 'existing_team', type: 'textarea', label: 'Existing team members', rows: 3, maxWords: 150, help: 'Anyone already attached — director, producer, cast or key crew.' }
        ]
      },
      {
        id: 'documents', title: 'Documents',
        intro: 'Upload what you have. PDFs only, up to 20 MB each.',
        fields: [
          { name: 'synopsis_pdf', type: 'file', label: 'Story synopsis', accept: ['application/pdf'], maxMB: 20 },
          { name: 'screenplay_pdf', type: 'file', label: 'Screenplay', accept: ['application/pdf'], maxMB: 20,
            requiredIf: { field: 'development_stage', in: ['screenplay'] },
            help: 'Required when your screenplay is complete.' },
          { name: 'pitch_deck_pdf', type: 'file', label: 'Pitch deck or presentation', accept: ['application/pdf'], maxMB: 20 },
          { name: 'supporting_docs', type: 'file', label: 'Additional supporting documents', accept: ['application/pdf'], maxMB: 20, maxFiles: 5 },
          { name: 'creator_status', type: 'radio', label: 'Are you the original creator or an authorized representative?', required: true, options: [
            { value: 'creator', label: 'I am the original creator (or a co-creator)' },
            { value: 'representative', label: 'I am authorized to represent the creator(s)' },
            { value: 'neither', label: 'Neither' }],
            invalidIf: { in: ['neither'], message: 'Only the creator or an authorized representative can submit this project.' } },
          { name: 'controls_rights', type: 'radio', label: 'Do you own or control the rights needed to submit this material?', required: true, options: YES_NO_UNSURE,
            note: { in: ['no', 'not_sure'], text: 'You can still submit. Our team may ask for more information about rights before reviewing further.' } },
          { name: 'third_party_rights', type: 'radio', label: 'Are any third-party rights involved?', required: true, options: YES_NO_UNSURE,
            help: 'For example: based on a book, a true story, existing characters, or music you don’t own.' },
          { name: 'third_party_details', type: 'textarea', label: 'Tell us about the third-party rights', rows: 3, maxWords: 150,
            showIf: { field: 'third_party_rights', in: ['yes', 'not_sure'] }, requiredIf: { field: 'third_party_rights', in: ['yes'] } }
        ]
      }
    ],
    declarations: [
      { name: 'accept_submission_terms', required: true, label: 'I have read and accept the Newton Cinema Project Submission Terms.', terms: 'submission' },
      { name: 'privacy_ack', required: true, label: 'I have read Tortil’s Privacy Policy and understand how my submission will be handled.', privacy: true },
      { name: 'accuracy', required: true, label: 'The information I’ve provided is accurate to the best of my knowledge.' }
    ],
    statuses: ['draft', 'submitted', 'under_review', 'more_info_requested', 'shortlisted', 'accepted', 'declined', 'withdrawn'],
    confirmation: {
      title: 'Your project has been submitted.',
      body: 'Thank you for sharing your story with Newton Cinema. Our team will review your submission according to our project evaluation process.'
    }
  };

  /* ------------------------------------------------------------------
     02  CAST
     ------------------------------------------------------------------ */
  var ADULT_AGES = opts([{ value: '18_24', label: '18–24' }, { value: '25_34', label: '25–34' }, { value: '35_44', label: '35–44' },
    { value: '45_54', label: '45–54' }, { value: '55_64', label: '55–64' }, { value: '65_plus', label: '65 or older' }]);
  var MINOR_AGES = opts([{ value: 'u6', label: 'Under 6' }, { value: '6_9', label: '6–9' }, { value: '10_12', label: '10–12' },
    { value: '13_15', label: '13–15' }, { value: '16_17', label: '16–17' }]);
  var MINOR = { field: 'profile_for', in: ['minor'] };

  var cast = {
    id: 'cast',
    code: 'CST',
    card: '02',
    cardLabel: 'Join as Cast',
    title: 'Join the Newton Cinema Cast Network',
    intro: 'Create a cast profile so Newton Cinema’s casting team can consider you for relevant opportunities. Newcomers are welcome.',
    steps: [
      {
        id: 'personal', title: 'Personal Info',
        intro: 'Basic details. Your account contact details are filled in for you.',
        fields: [ACCOUNT,
          { name: 'profile_for', type: 'radio', label: 'Who is this profile for?', required: true, options: [
            { value: 'self', label: 'Myself' },
            { value: 'minor', label: 'A child or young person (under 18) I’m the parent or legal guardian of' }] },
          { name: 'performer_name', type: 'text', label: 'Performer’s full name', showIf: MINOR, requiredIf: MINOR, maxLength: 120 },
          { name: 'guardian_relationship', type: 'select', label: 'Your relationship to the performer', showIf: MINOR, requiredIf: MINOR, half: true,
            options: opts(['Parent', 'Legal guardian']) },
          { name: 'stage_name', type: 'text', label: 'Professional or stage name', help: 'If you work under a different name.', maxLength: 120 },
          { name: 'age_range', type: 'select', label: 'Age range', required: true, half: true,
            help: 'We ask for an age range rather than a date of birth.',
            optionsBy: { field: 'profile_for', map: { self: ADULT_AGES, minor: MINOR_AGES } } }
        ].concat(location, [
          { name: 'profile_links', type: 'url', label: 'Professional profile link', placeholder: 'https://', help: 'Website, Instagram or another public profile.' }
        ])
      },
      {
        id: 'acting', title: 'Acting Profile',
        intro: 'Your languages, experience and the kind of work you’re interested in.',
        fields: [
          { name: 'primary_language', type: 'select', label: 'Primary acting language', required: true, options: LANGUAGES, other: true, half: true },
          { name: 'other_languages', type: 'checkboxes', label: 'Other fluent languages', options: LANGUAGES, other: true },
          { name: 'experience_level', type: 'radio', label: 'Acting experience', required: true, options: opts(['Newcomer', 'Beginner', 'Experienced', 'Professional']) },
          { name: 'years_experience', type: 'number', label: 'Years of experience', min: 0, max: 80, half: true, showIf: { field: 'experience_level', notIn: ['newcomer', ''] } },
          { name: 'performance_categories', type: 'checkboxes', label: 'Interested in', required: true, options: opts(['Film', 'Television', 'Web series', 'Commercials', 'Theatre', 'Voice acting']) },
          { name: 'preferred_role_types', type: 'text', label: 'Preferred role types', maxLength: 160, example: 'e.g. Lead, supporting, character roles, comedy' },
          { name: 'height_cm', type: 'number', label: 'Height (cm)', min: 50, max: 250, half: true },
          { name: 'appearance_notes', type: 'textarea', label: 'Appearance notes for casting', rows: 2, maxLength: 200,
            help: 'Only what’s useful for casting, such as “curly shoulder-length hair” or “visible tattoo on left forearm”. We don’t ask about ethnicity, caste, religion, health or disability.' }
        ]
      },
      {
        id: 'skills', title: 'Skills',
        intro: 'Select everything that applies.',
        fields: [
          { name: 'skills', type: 'checkboxes', label: 'Performance skills', options: opts(['Dancing', 'Singing', 'Martial arts', 'Sports', 'Driving', 'Horse riding', 'Stunts', 'Musical instruments']), other: true },
          { name: 'dance_styles', type: 'text', label: 'Dance styles', showIf: { field: 'skills', in: ['dancing'] }, example: 'e.g. Bharatanatyam, contemporary, hip-hop', maxLength: 160 },
          { name: 'martial_arts', type: 'text', label: 'Martial arts disciplines', showIf: { field: 'skills', in: ['martial_arts'] }, example: 'e.g. Kalaripayattu, karate', maxLength: 160 },
          { name: 'instruments', type: 'text', label: 'Instruments', showIf: { field: 'skills', in: ['musical_instruments'] }, example: 'e.g. Guitar, tabla', maxLength: 160 },
          { name: 'driving_licences', type: 'checkboxes', label: 'Driving licences held', showIf: { field: 'skills', in: ['driving'] }, options: opts(['Car', 'Motorcycle', 'Heavy vehicle']) },
          { name: 'skills_notes', type: 'textarea', label: 'Anything else about your skills?', rows: 2, maxWords: 80 }
        ]
      },
      {
        id: 'portfolio', title: 'Portfolio',
        intro: 'A clear, recent headshot is the most important item. Images: JPG or PNG up to 10 MB.',
        fields: [
          { name: 'headshot', type: 'file', label: 'Headshot', required: true, accept: ['image/jpeg', 'image/png'], maxMB: 10 },
          { name: 'portfolio_photos', type: 'file', label: 'Additional portfolio photos', accept: ['image/jpeg', 'image/png'], maxMB: 10, maxFiles: 6 },
          { name: 'intro_video_url', type: 'url', label: 'Introduction video link', placeholder: 'https://', help: 'A short self-introduction on YouTube, Vimeo or Google Drive.' },
          { name: 'showreel_url', type: 'url', label: 'Acting showreel link', placeholder: 'https://' },
          { name: 'imdb_url', type: 'url', label: 'IMDb profile', placeholder: 'https://www.imdb.com/name/…', pattern: 'imdb\\.com', patternMessage: 'Enter an imdb.com link.' },
          { name: 'previous_projects', type: 'textarea', label: 'Previous projects', rows: 4, maxWords: 250, example: 'e.g. “The Harbour” (2024, short film) — lead role' }
        ]
      },
      {
        id: 'availability', title: 'Availability',
        fields: [
          { name: 'availability', type: 'radio', label: 'Current availability', required: true, options: AVAILABILITY },
          { name: 'available_from', type: 'date', label: 'Available from', half: true, showIf: { field: 'availability', in: ['from_date'] }, requiredIf: { field: 'availability', in: ['from_date'] } },
          { name: 'preferred_locations', type: 'checkboxes', label: 'Preferred work locations', options: OFFICES },
          { name: 'willing_to_travel', type: 'radio', label: 'Are you able to travel for work?', required: true, options: YES_NO_UNSURE },
          { name: 'has_agent', type: 'radio', label: 'Do you have a professional agent or manager?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
          { name: 'agent_name', type: 'text', label: 'Agent or manager name', half: true, showIf: { field: 'has_agent', in: ['yes'] }, maxLength: 120 },
          { name: 'agent_email', type: 'email', label: 'Agent or manager email', half: true, showIf: { field: 'has_agent', in: ['yes'] } }
        ]
      }
    ],
    declarations: [
      { name: 'accuracy', required: true, label: 'The information I’ve provided is accurate to the best of my knowledge.' },
      { name: 'privacy_ack', required: true, label: 'I have read Tortil’s Privacy Policy.', privacy: true },
      { name: 'guardian_approval', requiredIf: MINOR, showIf: MINOR, label: 'As the parent or legal guardian, I approve this profile being created and reviewed for casting opportunities.' },
      { name: 'retain_profile', required: false, label: 'Optional: keep my profile so it can be considered for future casting opportunities.' }
    ],
    statuses: ['profile_draft', 'profile_submitted', 'under_review', 'active_talent_pool', 'shortlisted', 'archived'],
    confirmation: {
      title: 'Your cast profile has been submitted.',
      body: 'Thank you for your interest. Your profile can be considered for relevant casting opportunities, subject to our review process.'
    }
  };

  /* ------------------------------------------------------------------
     03  CREW
     ------------------------------------------------------------------ */
  var DEPARTMENTS = opts(['Direction', 'Camera', 'Lighting & Grip', 'Sound', 'Production', 'Art', 'Costume', 'Makeup & Hair', 'Editing', 'Post-production', 'VFX', 'Locations', 'Set Operations']);
  var ROLES = {
    direction: opts(['Director', 'First Assistant Director', 'Second Assistant Director', 'Script Supervisor']),
    camera: opts(['Director of Photography', 'Camera Operator', 'First Assistant Camera', 'Second Assistant Camera', 'DIT', 'Steadicam Operator', 'Drone Operator']),
    lighting_grip: opts(['Gaffer', 'Best Boy Electric', 'Lighting Technician', 'Key Grip', 'Grip']),
    sound: opts(['Production Sound Mixer', 'Boom Operator', 'Sound Assistant']),
    production: opts(['Line Producer', 'Production Manager', 'Production Coordinator', 'Production Assistant', 'Production Accountant']),
    art: opts(['Production Designer', 'Art Director', 'Set Decorator', 'Props Master', 'Art Assistant']),
    costume: opts(['Costume Designer', 'Wardrobe Supervisor', 'Costume Assistant']),
    makeup_hair: opts(['Makeup Artist', 'Hair Stylist', 'Prosthetics / SFX Makeup']),
    editing: opts(['Editor', 'Assistant Editor']),
    post_production: opts(['Post-production Supervisor', 'Colorist', 'Sound Designer', 'Re-recording Mixer']),
    vfx: opts(['VFX Supervisor', 'Compositor', '3D Artist', 'VFX Coordinator']),
    locations: opts(['Location Manager', 'Location Scout']),
    set_operations: opts(['Set Manager', 'Runner', 'Transport Coordinator', 'Craft Services'])
  };

  var crew = {
    id: 'crew',
    code: 'CRW',
    card: '03',
    cardLabel: 'Join as Crew',
    title: 'Join the Newton Cinema Crew Network',
    intro: 'Share your role, experience and availability so Newton Cinema productions can consider you. This is an application to join a professional network, not an employment contract.',
    steps: [
      {
        id: 'personal', title: 'Personal Info',
        fields: [ACCOUNT].concat(location)
      },
      {
        id: 'role', title: 'Professional Role',
        intro: 'Choose your department first — the role list updates to match.',
        fields: [
          { name: 'primary_department', type: 'select', label: 'Primary department', required: true, options: DEPARTMENTS, other: true, half: true },
          { name: 'primary_role', type: 'select', label: 'Primary job title', required: true, half: true, other: true,
            optionsBy: { field: 'primary_department', map: ROLES } },
          { name: 'secondary_departments', type: 'checkboxes', label: 'Secondary skills or departments', options: DEPARTMENTS },
          { name: 'experience_level', type: 'radio', label: 'Experience level', required: true, options: opts(['Trainee', 'Assistant', 'Mid-level', 'Senior', 'Head of department']) },
          { name: 'years_experience', type: 'select', label: 'Years of experience', required: true, half: true, options: [
            { value: '0_1', label: 'Less than 1 year' }, { value: '1_4', label: '1–4 years' }, { value: '5_9', label: '5–9 years' },
            { value: '10_19', label: '10–19 years' }, { value: '20_plus', label: '20+ years' }] },
          { name: 'employment_preference', type: 'checkboxes', label: 'Employment preference', required: true, options: opts(['Freelance', 'Contract', 'Project-based', 'Full-time']) }
        ]
      },
      {
        id: 'experience', title: 'Experience',
        intro: 'Your work so far and your technical skills.',
        fields: [
          { name: 'credits', type: 'repeater', label: 'Previous film projects', maxItems: 6, help: 'Add up to six recent projects.',
            item: [
              { name: 'title', type: 'text', label: 'Project title', required: true, maxLength: 120 },
              { name: 'role', type: 'text', label: 'Role performed', required: true, maxLength: 80 },
              { name: 'year', type: 'number', label: 'Year', min: 1950, max: 2030 },
              { name: 'company', type: 'text', label: 'Production company', maxLength: 120 }
            ] },
          { name: 'cv', type: 'file', label: 'Resume / CV', required: true, accept: ['application/pdf'], maxMB: 10, help: 'PDF, up to 10 MB.' },
          { name: 'portfolio_url', type: 'url', label: 'Portfolio or showreel link', placeholder: 'https://' },
          { name: 'imdb_url', type: 'url', label: 'IMDb profile', placeholder: 'https://www.imdb.com/name/…', pattern: 'imdb\\.com', patternMessage: 'Enter an imdb.com link.' },
          { name: 'references', type: 'textarea', label: 'Credits and references', rows: 3, maxWords: 150, help: 'Names and roles of people who can speak to your work. We’ll ask before contacting anyone.' },
          { name: 'equipment_proficiency', type: 'textarea', label: 'Equipment proficiency', rows: 2, maxWords: 100, example: 'e.g. ARRI Alexa Mini LF, RED Komodo, Aputure lighting, Sound Devices 833' },
          { name: 'software', type: 'checkboxes', label: 'Software proficiency', options: opts(['DaVinci Resolve', 'Adobe Premiere Pro', 'Avid Media Composer', 'Final Cut Pro', 'After Effects', 'Nuke', 'Pro Tools', 'Movie Magic']), other: true },
          { name: 'languages', type: 'checkboxes', label: 'Working languages', required: true, options: LANGUAGES, other: true },
          { name: 'certifications', type: 'text', label: 'Certifications', maxLength: 200, example: 'e.g. Drone pilot licence, first aid, electrical safety' }
        ]
      },
      {
        id: 'availability', title: 'Availability',
        fields: [
          { name: 'availability', type: 'radio', label: 'Current availability', required: true, options: AVAILABILITY },
          { name: 'available_from', type: 'date', label: 'Available from', half: true, showIf: { field: 'availability', in: ['from_date'] }, requiredIf: { field: 'availability', in: ['from_date'] } },
          { name: 'preferred_locations', type: 'checkboxes', label: 'Preferred working region', required: true, options: OFFICES },
          { name: 'willing_to_travel', type: 'radio', label: 'Willing to travel?', required: true, options: YES_NO_UNSURE },
          { name: 'work_permit_needed', type: 'radio', label: 'Would you need a visa or work permit for any of these locations?', options: YES_NO_UNSURE,
            help: 'Only relevant if you selected a location outside the country where you’re allowed to work.' },
          { name: 'rate_range', type: 'text', label: 'Expected rate range', private: true, maxLength: 80, half: true, example: 'e.g. ₹15,000–20,000 per day',
            help: 'Visible only to Newton production reviewers.' },
          { name: 'equipment_owned', type: 'textarea', label: 'Equipment you own', rows: 2, maxWords: 100, help: 'Kit you can bring to a production.' }
        ]
      }
    ],
    declarations: [
      { name: 'accuracy', required: true, label: 'The information I’ve provided is accurate to the best of my knowledge.' },
      { name: 'privacy_ack', required: true, label: 'I have read Tortil’s Privacy Policy.', privacy: true },
      { name: 'retain_profile', required: false, label: 'Optional: keep my profile so it can be considered for future projects.' }
    ],
    statuses: ['draft', 'submitted', 'under_review', 'approved_talent_pool', 'shortlisted', 'archived'],
    confirmation: {
      title: 'Your crew profile has been submitted.',
      body: 'Thank you for joining our professional network. Your details can be reviewed for suitable production opportunities.'
    }
  };

  /* ------------------------------------------------------------------
     04  CAREERS
     ------------------------------------------------------------------ */
  // No real vacancies are known for the prototype, so none are invented.
  var JOB_OPENINGS = [];

  var career = {
    id: 'career',
    code: 'CAR',
    card: '04',
    cardLabel: 'Careers at Newton',
    title: 'Careers at Newton Cinema',
    intro: 'Apply for a role at Newton Cinema or send a general application across creative, production, corporate, product and engineering teams.',
    steps: [
      {
        id: 'about', title: 'About You',
        fields: [ACCOUNT].concat(location, [
          { name: 'linkedin_url', type: 'url', label: 'LinkedIn profile', placeholder: 'https://www.linkedin.com/in/…', half: true },
          { name: 'portfolio_url', type: 'url', label: 'Portfolio or website', placeholder: 'https://', half: true }
        ])
      },
      {
        id: 'interest', title: 'Job Interest',
        fields: [
          { name: 'application_type', type: 'radio', label: 'What are you applying for?', required: true, options: [
            { value: 'opening', label: 'A specific opening' }, { value: 'general', label: 'General application' }] },
          { name: 'job_opening', type: 'select', label: 'Position', options: JOB_OPENINGS.map(function (j) { return { value: j.id, label: j.title }; }),
            showIf: { field: 'application_type', in: ['opening'] }, requiredIf: { field: 'application_type', in: ['opening'] },
            emptyText: 'There are no open positions listed right now. You can send a general application instead.',
            requiredMessage: 'No positions are open right now. Choose \u201cGeneral application\u201d to continue.' },
          { name: 'position_interest', type: 'text', label: 'Role or area you’re interested in', maxLength: 120,
            showIf: { field: 'application_type', in: ['general'] }, requiredIf: { field: 'application_type', in: ['general'] }, example: 'e.g. Development executive, UX designer' },
          { name: 'department', type: 'select', label: 'Department', required: true, half: true, options: opts(['Development & Creative', 'Production', 'Post-production', 'Distribution & Marketing', 'Finance', 'Legal & Business Affairs', 'Operations', 'People & HR', 'Product & Design', 'Engineering']), other: true },
          { name: 'preferred_location', type: 'select', label: 'Preferred work location', required: true, half: true, options: opts(['Los Angeles', 'San Francisco', 'Boston', 'Mumbai', 'Kochi', 'Colombo', 'Remote']) },
          { name: 'work_arrangement', type: 'radio', label: 'Work arrangement', required: true, options: opts(['On-site', 'Hybrid', 'Remote']) },
          { name: 'employment_type', type: 'radio', label: 'Employment type', required: true, options: opts(['Full-time', 'Part-time', 'Contract', 'Internship']) },
          { name: 'notice_period', type: 'select', label: 'Notice period', required: true, half: true, options: [
            { value: 'immediate', label: 'Available immediately' }, { value: '2w', label: '2 weeks' }, { value: '1m', label: '1 month' },
            { value: '2m', label: '2 months' }, { value: '3m_plus', label: '3 months or more' }] },
          { name: 'earliest_start', type: 'date', label: 'Earliest joining date', half: true },
          { name: 'salary_expectation', type: 'text', label: 'Salary expectations', private: true, maxLength: 80, example: 'e.g. ₹18–22 LPA or $90,000–100,000',
            help: 'Expectations only — we never ask about your current or past salary.' },
          { name: 'work_authorization', type: 'radio', label: 'Are you authorized to work in your preferred location?', options: [
            { value: 'yes', label: 'Yes' }, { value: 'sponsorship', label: 'I would need sponsorship' }, { value: 'not_sure', label: 'Not sure' }] }
        ]
      },
      {
        id: 'experience', title: 'Experience',
        fields: [
          { name: 'current_title', type: 'text', label: 'Current job title', half: true, maxLength: 120, help: 'Leave blank if you’re a student or between roles.' },
          { name: 'current_employer', type: 'text', label: 'Current employer', half: true, maxLength: 120 },
          { name: 'total_years', type: 'select', label: 'Total years of experience', required: true, half: true, options: [
            { value: '0_1', label: 'Less than 1 year' }, { value: '1_3', label: '1–3 years' }, { value: '4_7', label: '4–7 years' },
            { value: '8_12', label: '8–12 years' }, { value: '13_plus', label: '13+ years' }] },
          { name: 'highest_qualification', type: 'select', label: 'Highest qualification', required: true, half: true, options: opts(['Secondary school', 'Diploma or certificate', 'Bachelor’s degree', 'Master’s degree', 'Doctorate', 'Prefer not to say']) },
          { name: 'skills', type: 'text', label: 'Primary professional skills', required: true, maxLength: 200, example: 'e.g. Script development, story notes, Final Draft' },
          { name: 'relevant_experience', type: 'textarea', label: 'Relevant experience', required: true, rows: 5, maxWords: 300 }
        ]
      },
      {
        id: 'resume', title: 'Resume',
        fields: [
          { name: 'cv', type: 'file', label: 'Resume / CV', required: true, accept: ['application/pdf'], maxMB: 10, help: 'PDF, up to 10 MB.' },
          { name: 'portfolio_file', type: 'file', label: 'Portfolio', accept: ['application/pdf'], maxMB: 20, help: 'PDF, up to 20 MB.' },
          { name: 'why_newton', type: 'textarea', label: 'Why are you interested in Newton Cinema?', required: true, rows: 4, maxWords: 200 },
          { name: 'introduction', type: 'textarea', label: 'Brief introduction', rows: 3, maxWords: 150 },
          { name: 'project_experience', type: 'textarea', label: 'Relevant project experience', rows: 3, maxWords: 200 },
          { name: 'comments', type: 'textarea', label: 'Additional comments', rows: 2, maxWords: 150 }
        ]
      }
    ],
    declarations: [
      { name: 'privacy_ack', required: true, label: 'I have read Tortil’s Privacy Policy.', privacy: true },
      { name: 'accuracy', required: true, label: 'The information I’ve provided is accurate to the best of my knowledge.' },
      { name: 'retain_application', required: false, label: 'Optional: keep my application for future opportunities.' }
    ],
    statuses: ['submitted', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected', 'withdrawn'],
    applicantStatusLabel: 'Received', // internal hiring statuses are not shown to applicants
    confirmation: {
      title: 'Your application has been received.',
      body: 'Thank you for your interest in working with Newton Cinema. Our recruitment team will review your application.'
    }
  };

  var SUBMISSION_TERMS = {
    version: 'DRAFT-2026-10-08',
    status: 'Draft for legal review — not approved for use',
    points: [
      'Newton Cinema receives many ideas and may already be developing projects similar to yours. Submitting does not create a confidential relationship or a non-disclosure agreement.',
      'You keep ownership of your material. Submitting does not transfer any rights to Newton Cinema.',
      'Newton Cinema is not obliged to review, respond to, develop, finance or produce any submission.',
      'Submissions are evaluated by Newton Cinema’s development team using its internal evaluation process.',
      'Submitting does not register or guarantee copyright. Consider registering your work before you submit.',
      'Any further discussion or collaboration would need a separate written agreement signed by both parties.'
    ]
  };

  window.TORTIL_FORMS = {
    intents: ['new_project', 'cast', 'crew', 'career'],
    forms: { new_project: new_project, cast: cast, crew: crew, career: career },
    submissionTerms: SUBMISSION_TERMS,
    jobOpenings: JOB_OPENINGS
  };
})();
