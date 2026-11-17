-- HWC Trainer Suite — starter data (all editable in Admin → Lists / Facilities / Settings)

insert into public.facilities (name, short_code, city, state)
values ('Arch Vista Behavioral Health', 'AVBH', 'St. Louis', 'MO')
on conflict (name) do nothing;

insert into public.lookup_values (category, value, sort_order)
select category, value, ord::int * 10
from (values
  ('student_type', array['Direct Care Staff', 'Mental Health Technician', 'Registered Nurse', 'Licensed Practical Nurse',
                         'Therapist / Counselor', 'Provider / Physician', 'Teacher / Education Staff', 'Security',
                         'Supervisor / Manager', 'Administration', 'Support Services', 'Contract / Agency Staff', 'Other']),
  ('department',   array['Adolescent Unit', 'Adult Unit', 'Child Unit', 'Intake / Assessment', 'Nursing', 'Clinical',
                         'Education', 'Security', 'Administration', 'Dietary', 'Environmental Services', 'Float Pool', 'Other']),
  ('course_type',  array['Initial Certification', 'Annual Recertification', 'Verbal Program Only', 'Physical Program Only',
                         'Refresher / Remediation', 'Instructor Practice']),
  ('technique',    array['Verbal De-escalation', 'Personal Safety Stance', 'Blocking / Deflection', 'Release from Grab',
                         'Release from Choke', 'Hair Pull Release', 'Bite Release', 'Escort', 'Standing Hold',
                         'Seated Hold', 'Team Hold', 'Transition / Disengagement', 'Other']),
  ('incident_type',array['Strain / Sprain', 'Bruise / Contusion', 'Abrasion / Scrape', 'Slip / Fall', 'Joint Hyperextension',
                         'Head / Face Contact', 'Cut / Laceration', 'Equipment or Mat Issue', 'Technique Error (No Injury)',
                         'Near Miss', 'Other']),
  ('body_part',    array['Head / Face', 'Neck', 'Shoulder', 'Arm / Elbow', 'Wrist / Hand / Finger', 'Back', 'Chest / Torso',
                         'Hip', 'Knee', 'Leg / Ankle / Foot', 'Multiple', 'None']),
  ('location',     array['Training Room', 'Gymnasium', 'Conference Room', 'Classroom', 'Unit Day Room', 'Off-site']),
  ('job_title',    array['Mental Health Technician', 'Behavioral Health Associate', 'Registered Nurse', 'LPN', 'Therapist',
                         'Teacher', 'Security Officer', 'Charge Nurse', 'Unit Supervisor', 'Administrator']),
  ('contributing_factor', array['Inadequate warm-up', 'Fatigue', 'Improper technique', 'Partner size mismatch',
                         'Insufficient spacing', 'Mat / floor condition', 'Footwear / attire / jewelry', 'Pre-existing condition',
                         'Horseplay', 'Rushed practice', 'Unclear instruction'])
) as v(category, vals),
lateral unnest(vals) with ordinality as u(value, ord)
on conflict (category, value) do nothing;

insert into public.app_settings (key, value) values
  ('certificate', jsonb_build_object(
      'expiration_months', 12,
      'default_theme', 'navy',
      'program_label', 'Basic Training Program',
      'signer_title', 'Certified HWC Instructor',
      'footer_text', 'Handle With Care Behavior Management System',
      'show_qr', true)),
  ('organization', jsonb_build_object(
      'suite_name', 'Handle With Care Trainer Suite',
      'organization', 'Arch Vista Behavioral Health'))
on conflict (key) do nothing;
