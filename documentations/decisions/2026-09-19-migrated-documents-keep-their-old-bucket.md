# Migrated documents keep their old bucket, and that is an exception with a date on it

Date: 2026-09-19. Status: accepted, with the fix written and unrun.
Source: the document convergence round, after Dre's storage rule.

## The fact

The two stores that retired into `rent_ops.Document` did not write to the
same place.

`property.PropertyDocument` uploaded through `r2_document_uploader`, which
writes to `STORAGE_DOCUMENTS_BUCKET_NAME`, the private documents bucket. Its
rows migrate in pointing at objects that were already in the right bucket.

`tenant.LeaseDocument` uploaded through Django's own `FileField`, which is
`STORAGES["default"]`. On R2 that is `R2PublicMediaStorage`, a different
bucket with `querystring_auth = False` and a public URL. On S3 it is
`PublicMediaStorage` inside the one `heimly-prod-app-storage` bucket, where
public read is granted by bucket policy on a prefix.

So signed tenancy agreements have been sitting behind unsigned, publicly
resolvable URLs, on both backends, since the lease document feature shipped.
Ten of them exist in the development bucket today. That predates this round;
this round is where it was noticed.

The `PropertyDocument` upload path had a second version of the same problem:
its view uploaded to the documents bucket explicitly and then called
`serializer.save()` with the file still attached, so Django wrote a second
copy through the default storage into the public media bucket. The API only
ever returned the private one. Retiring that view removes the double write
going forward; the copies it already made are still there.

## Decision

The backfill migrations do not move objects. Each library row records the
bucket its object is actually in, through the new `Document.storage_bucket`
column, and every read goes through the shared storage client with that
bucket. Copying objects inside a migration is a deploy that can fail halfway
across an unknown number of files, and a failed object copy in the middle of
a schema migration is a much worse morning than a file in the wrong bucket.

The copy is a management command instead,
`rent_ops relocate_legacy_documents`, which is restartable, safe to run
twice, and verifies each object reads back in its new home before removing
the old one. It has not been run anywhere.

## Why it is not run yet

`LeaseDocument.file` is still a Django `FileField`, and until this round its
serialiser handed out `obj.file.url` directly. Deleting the source object
would have broken the lease documents modal on the spot.

That coupling is now removed: `LeaseDocumentSerializer.get_file_url` returns
a short lived signed URL from the library whenever the row has a library
document that is readable, and falls back to the old unsigned URL only for
rows the library has not taken over. The raw `file` field is no longer
serialised at all.

So the order of operations is: this round ships, the signed URL becomes the
one every client uses, and then the relocation can run and take the public
copies with it.

## What is still true until it runs

Anybody who has, or can guess, the old public URL of a migrated agreement can
still open it without signing in. New uploads are not affected: they go to
the org scoped key in the private documents bucket and are only ever reachable
through a presigned GET.

Organisation isolation does not rest on this. It rests on the key prefix,
`org/<organisation uuid>/documents/<document uuid>`, and on presigned access
only, which is deliberate because on S3 the media bucket and the documents
bucket are the same bucket separated by prefix.

## Browser uploads: checked, and mostly fine

Settled 2026-09-19 by reading the live bucket configuration rather than
assuming it. Both R2 buckets carry the same CORS rules: `GET, PUT, POST,
DELETE, HEAD`, all headers allowed, and origins `https://www.heimly.ng`,
`https://heimly.ng`, `http://localhost:3000`, `http://localhost:8080` and
`http://localhost:8000`. So a presigned PUT from the local dev server works,
and the documents bucket is configured exactly like the media bucket that has
been serving browser uploads all along.

The upload itself uses the same call shape as
`property/services/presigned_upload.py`, which is the path already proven in
a browser: `generate_presigned_url("put_object", ...)` with a bucket, a key
and a content type, and no S3 only parameters. The one deliberate difference
is that the documents path signs a constant `application/octet-stream` rather
than the type the client declared, so a client cannot pin a type onto the
object by choosing what it says. That changes nothing about CORS, because
both paths send a `Content-Type` header and the rule allows all headers.

One gap worth knowing about rather than fixing here: the pre-prod box's own
origin is not in either allowlist. Uploads from a browser pointed at pre-prod
would fail the preflight until it is added.

## Revisit when

The relocation command has been run in every environment and reports zero
rows left with a `storage_bucket` that is not the documents bucket. At that
point this record can be closed and the fallback branch in
`LeaseDocumentSerializer.get_file_url` can go.
