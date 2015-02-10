Testing pigshell
================

Pigshell testing is very limited and far from adequate. This document talks
about the few functional tests of filesystems and commands which exist and how
to run them. In future, this will expand to cover all other categories of tests
which exist and should exist for proper test coverage.
 
These tests are written in pigshell itself and must be run from inside
pigshell.

## Setup

Once you have a [local setup](../src/doc/local.md), run the following from the
top level source directory:

    make clean
    make release

Ensure that the local webserver points to the source directory. Make a copy
of the pigshell source directory to a test directory.

    cp -r <source> <testdir>

Run `psty` pointing to the test directory

    python psty.py -a -d <testdir>

Edit `<testdir>/test/ptest/config.sh` to add test account details. Make sure
the corresponding data sources (Google, Facebook) are connected before
starting the tests.

## Testing

In pigshell, run the following commands:

    mount http://localhost:50937/ /home  # Skip if /home already mounted
    cd /home/test/ptest
    ./runall.sh

Each test is structured to dump its output in the
`<testdir>/test/ptest/results` directory and the output is compared with the
reference output stored in the `ref` directory at the same level.

One line is printed per test, with the following possibities:

  - `ok`: The test passed, and the result matched the reference output
  - `fail`: The test failed
  - `ok (diff failed)`: The test passed, but the output was not as expected.

## Pre-Release Testing

Before we can tag a pigshell release, we must test on the following
environments:

  - Server (psty) environment
    - Mac OS X, python 2.7
    - Ubuntu 14.04, python 2.7
  - Browser environment
    - Mac OS X: Version Now of Chrome, Firefox, Safari
    - Ubuntu 14.04: Version Now of Chrome, Firefox
    - Windows 7: Version Now of Chrome, Firefox

This reflects, in decreasing order, the platforms the dev team cares about.

On these environments, we run

  - Click on all the "Example" links in the rightbar after connecting Facebook
  - Functional tests (described above)
