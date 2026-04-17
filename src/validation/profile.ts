import { z } from 'zod';

const socialLinkList = (value: string | undefined) =>
  (value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export const profileFormSchema = z.object({
  displayName: z.string().trim().max(64, 'Display name must be at most 64 characters').optional(),
  bio: z.string().trim().max(400, 'Bio must be at most 400 characters').optional(),
  school: z.string().trim().max(120, 'School must be at most 120 characters').optional(),
  isPrivate: z.boolean(),
  instagramUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\//.test(value), 'Instagram URL must be valid'),
  socialLinks: z
    .string()
    .optional()
    .refine((value) => socialLinkList(value).length <= 8, 'Add at most 8 social links')
    .refine(
      (value) => socialLinkList(value).every((item) => /^https?:\/\//.test(item)),
      'Each social link must be a valid URL',
    ),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function toProfilePayload(values: ProfileFormValues) {
  const payload: {
    displayName?: string;
    bio?: string;
    school?: string;
    isPrivate?: boolean;
    instagramUrl?: string;
    socialLinks?: string[];
  } = {
    isPrivate: values.isPrivate,
  };

  const displayName = values.displayName?.trim();
  const bio = values.bio?.trim();
  const school = values.school?.trim();
  const instagramUrl = values.instagramUrl?.trim();
  const socialLinks = socialLinkList(values.socialLinks);

  if (displayName) payload.displayName = displayName;
  if (bio) payload.bio = bio;
  if (school) payload.school = school;
  if (instagramUrl) payload.instagramUrl = instagramUrl;
  if (socialLinks.length > 0) payload.socialLinks = socialLinks;

  return payload;
}