# The test suite never touches the search cluster, enforced where pytest cannot escape it

Date: 2026-09-22. Status: accepted. Source: chasing a four row first page on the
marketplace for the third time.

## Decision

`core/settings.py` turns `OPENSEARCH_DSL_AUTOSYNC` off whenever `pytest` is in
`sys.modules`. The signal processor also reads the setting per call, because it
enqueues its own Celery task rather than going through `registry.update()`,
which is where the package checks it.

`conftest.py` keeps its autouse fixture. It is no longer the only guard.

## Why the earlier guard did nothing

The repo has had a root `conftest.py` disabling autosync since September, with a
docstring explaining exactly this failure. It never ran.

`runtests` invokes pytest with `-c others/pytest.ini`. That makes `others/` the
rootdir, and pytest collects conftest files from the rootdir downwards, so a
`conftest.py` one level above it is never loaded. The guard was correct, visible
in the repository, and inert.

Measured: rebuild the index to 65 documents, run one five test file, count 70.
With the settings guard, 65 and 65.

## What it was costing

Every property a test created was indexed into the cluster the application
reads from, and the row disappeared with the test database. Search then named
listings the database could not produce, `_hydrate` dropped them, and the page
came back short while the count above it stayed high: 102 documents for 27
published properties, 37 ids whose rows were gone.

A short page reads as a design choice rather than a fault, which is why it
survived two rounds of being "fixed" by rebuilding the index.

## Consequences

The marketplace read path now logs when the index names listings it cannot
find, with the ids, so drift is visible rather than silent. Rebuilding the index
remains the cure:

    manage.py opensearch index rebuild property_listings --force
    manage.py opensearch document index -i property_listings --force

`index rebuild` drops and recreates and leaves it empty, so the second command
is not optional.

De-indexing runs after the delete commits and through a queue, so a worker that
is down will still let the index run ahead of the table. That is a different
failure from this one and the log line is what will surface it.

## A note on the runner

`others/pytest.ini` is gitignored, so the `--confcutdir` that would also fix
conftest collection cannot be committed. The settings guard is the one that
ships, which is the more robust of the two anyway: it holds however pytest is
invoked, including in CI.
