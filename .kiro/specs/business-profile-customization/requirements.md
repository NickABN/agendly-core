# Requirements Document

## Introduction

This feature allows business owners and admins on Agendly to customize their business profile by uploading a logo, uploading a cover/banner image, and registering their physical location with structured address fields plus an interactive map. Images are stored in S3-compatible object storage (Cloudflare R2 recommended), uploaded via the NestJS backend as multipart/form-data. Each image upload is versioned — previous images are retained in storage and the database. Location data combines free-text address fields with latitude/longitude coordinates, which can be set via geocoding or by dragging a map pin.

## Glossary

- **Tenant**: A business registered on Agendly. Maps to the `Tenant` model in the database.
- **Profile_API**: The NestJS REST API module responsible for reading and updating business profile data.
- **Upload_Service**: The NestJS service responsible for receiving image files, validating them, uploading them to object storage, and persisting version records.
- **Object_Storage**: An S3-compatible storage service (e.g. Cloudflare R2) that stores uploaded images and serves them via public URLs.
- **Image_Version**: A record that tracks a historical upload of a logo or banner image for a tenant, including the URL, file size, and upload timestamp.
- **Geocoder**: An external geocoding API (e.g. Google Maps Geocoding API or Mapbox) that converts a text address into latitude/longitude coordinates.
- **Location_Form**: The frontend UI component that allows users to enter a structured address and adjust a map pin.
- **Profile_Page**: The frontend settings page where authorized users manage the business profile.
- **Authorized_User**: A `User` with role `OWNER` or `ADMIN` belonging to the current tenant.

---

## Requirements

### Requirement 1: View Business Profile

**User Story:** As an authorized user, I want to view the current business profile, so that I can see what information is publicly associated with my business.

#### Acceptance Criteria

1. WHEN an Authorized_User requests the business profile, THE Profile_API SHALL return the tenant's current name, phone, address, logoUrl, bannerUrl, latitude, longitude, and timezone.
2. THE Profile_API SHALL scope all profile reads to the requesting user's tenantId using TenantGuard.
3. IF the tenant has no logo uploaded, THEN THE Profile_API SHALL return `null` for the `logoUrl` field.
4. IF the tenant has no banner uploaded, THEN THE Profile_API SHALL return `null` for the `bannerUrl` field.

---

### Requirement 2: Upload Business Logo

**User Story:** As an authorized user, I want to upload a logo for my business, so that clients can visually identify my brand.

#### Acceptance Criteria

1. WHEN an Authorized_User submits a logo upload request with a valid image file, THE Upload_Service SHALL accept files in JPEG or PNG format only.
2. WHEN an Authorized_User submits a logo upload request, THE Upload_Service SHALL reject files larger than 5 MB and return a 422 error with a descriptive message.
3. WHEN an Authorized_User submits a file with an unsupported MIME type, THE Upload_Service SHALL reject the request with a 422 error before writing to Object_Storage.
4. WHEN a valid logo file is received, THE Upload_Service SHALL upload the file to Object_Storage under a path scoped to the tenant (e.g. `tenants/{tenantId}/logos/{timestamp}-{filename}`).
5. WHEN the upload to Object_Storage succeeds, THE Upload_Service SHALL create an Image_Version record linked to the tenant with the public URL, file size in bytes, image type (`logo`), and upload timestamp.
6. WHEN the upload to Object_Storage succeeds, THE Upload_Service SHALL update the `logoUrl` field on the Tenant record to the new public URL.
7. WHEN an upload to Object_Storage fails, THE Upload_Service SHALL return a 502 error and SHALL NOT create an Image_Version record or update the Tenant.
8. THE Upload_Service SHALL perform the Tenant update and Image_Version creation within a single Prisma transaction to ensure consistency.

---

### Requirement 3: Upload Business Banner Image

**User Story:** As an authorized user, I want to upload a banner/cover image for my business, so that my profile page has a visual identity beyond just the logo.

#### Acceptance Criteria

1. WHEN an Authorized_User submits a banner upload request with a valid image file, THE Upload_Service SHALL accept files in JPEG or PNG format only.
2. WHEN an Authorized_User submits a banner upload request, THE Upload_Service SHALL reject files larger than 8 MB and return a 422 error with a descriptive message.
3. WHEN an Authorized_User submits a file with an unsupported MIME type for the banner, THE Upload_Service SHALL reject the request with a 422 error before writing to Object_Storage.
4. WHEN a valid banner file is received, THE Upload_Service SHALL upload the file to Object_Storage under a path scoped to the tenant (e.g. `tenants/{tenantId}/banners/{timestamp}-{filename}`).
5. WHEN the banner upload to Object_Storage succeeds, THE Upload_Service SHALL create an Image_Version record linked to the tenant with the public URL, file size in bytes, image type (`banner`), and upload timestamp.
6. WHEN the banner upload to Object_Storage succeeds, THE Upload_Service SHALL update the `bannerUrl` field on the Tenant record to the new public URL.
7. WHEN a banner upload to Object_Storage fails, THE Upload_Service SHALL return a 502 error and SHALL NOT create an Image_Version record or update the Tenant.
8. THE Upload_Service SHALL perform the Tenant update and Image_Version creation within a single Prisma transaction to ensure consistency.

---

### Requirement 4: Image Version History

**User Story:** As an authorized user, I want previous logo and banner images to be retained, so that I can track changes over time and the system preserves upload history.

#### Acceptance Criteria

1. THE Upload_Service SHALL retain all previous Image_Version records when a new logo or banner is uploaded; no Image_Version record SHALL be deleted on replacement.
2. WHEN an Authorized_User requests the image history for a tenant, THE Profile_API SHALL return all Image_Version records for that tenant ordered by upload timestamp descending.
3. THE Profile_API SHALL scope all Image_Version reads to the requesting user's tenantId.
4. WHILE an Image_Version record exists, THE Object_Storage SHALL retain the corresponding file (files are not deleted from storage on replacement).

---

### Requirement 5: Update Business Location

**User Story:** As an authorized user, I want to register my business's physical location with a structured address and map pin, so that clients can find my business easily.

#### Acceptance Criteria

1. WHEN an Authorized_User submits a location update with a text address, THE Profile_API SHALL store the address string in the `address` field of the Tenant record.
2. WHEN an Authorized_User submits explicit latitude and longitude values, THE Profile_API SHALL validate that latitude is a decimal between -90 and 90 and longitude is a decimal between -180 and 180.
3. IF latitude or longitude values are outside their valid ranges, THEN THE Profile_API SHALL return a 422 error with a descriptive message identifying which field is invalid.
4. WHEN an Authorized_User submits a text address without explicit coordinates, THE Profile_API SHALL request geocoding from the Geocoder and store the returned latitude and longitude on the Tenant record.
5. IF the Geocoder returns no results for the provided address, THEN THE Profile_API SHALL store the address text and set latitude and longitude to `null`, and SHALL return a response indicating that coordinates could not be resolved.
6. IF the Geocoder is unavailable, THEN THE Profile_API SHALL store the address text, set latitude and longitude to `null`, and return a 200 response with a warning indicating geocoding was skipped.
7. WHEN a location update is submitted, THE Profile_API SHALL update only the `address`, `latitude`, and `longitude` fields; other Tenant fields SHALL remain unchanged.

---

### Requirement 6: Update General Business Profile Fields

**User Story:** As an authorized user, I want to update my business name, phone number, and timezone, so that my profile information stays current.

#### Acceptance Criteria

1. WHEN an Authorized_User submits a profile update with a business name, THE Profile_API SHALL validate that the name is between 2 and 100 characters.
2. WHEN an Authorized_User submits a profile update with a phone number, THE Profile_API SHALL validate that the phone number matches the E.164 format (e.g. `+521XXXXXXXXXX`).
3. WHEN an Authorized_User submits a profile update with a timezone, THE Profile_API SHALL validate that the timezone is a valid IANA timezone identifier.
4. IF any field fails validation, THEN THE Profile_API SHALL return a 422 error listing all invalid fields and their reasons.
5. WHEN all submitted fields pass validation, THE Profile_API SHALL update only the provided fields on the Tenant record (partial update / PATCH semantics).

---

### Requirement 7: Authorization Enforcement

**User Story:** As a system operator, I want all profile mutation endpoints to be restricted to authorized users, so that unauthorized parties cannot modify business data.

#### Acceptance Criteria

1. WHEN an unauthenticated request is made to any profile mutation endpoint, THE Profile_API SHALL return a 401 error.
2. WHEN an authenticated user with a role other than `OWNER` or `ADMIN` attempts a profile mutation, THE Profile_API SHALL return a 403 error.
3. THE Profile_API SHALL use TenantGuard on all profile endpoints to ensure a user can only read or modify the Tenant associated with their own tenantId.
4. IF an authenticated user attempts to access or modify a Tenant with a different tenantId, THEN THE Profile_API SHALL return a 403 error.
