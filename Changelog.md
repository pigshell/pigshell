Changelog
=========

0.6.4
-----

  * In Picasa, `rm <album>` complains if album is not empty. Earlier it would
    wipe the album in accordance with the underlying API - a nasty shock for
    those who expect standard Unix semantics of ENOTEMPTY.

  * `wsh` works on Safari.

0.6.3
-----

  * New syntax: Here documents.

        echo <<EOH
        <p style="color: firebrick;">Can be used anywhere in place of a string.
        Defines a multiline string where special characters and newlines don't
        need to be escaped. Nothing inside is interpreted or expanded. Useful to
        create scripts which are (readable!) composites of pigshell, javascript
        and HTML.</p>
        EOH | jf <<EOH
        (function() {
            return x.toLowerCase();
        })()
        EOH | html

  * New command: `theme` customizes pigshell CSS. e.g.

        theme /usr/theme/solarized.dark

  * New command: `shift` shifts positional arguments to shell or function
    by n.
  * New command: `hgrep` extracts a subset of input HTML specified by a
    CSS-like selector, optionally filtered by another selector which specifies
    descendant constraints. e.g.

        url="http://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population"
        cat $url | hgrep "table.wikitable tr" "td:contains(Island)" | html

  * Lots of tests
  * Lots of bugfixes


0.6.2
-----

  * Minor bugfixes

0.6.1
-----

  * Firefox Linux stack overflows reported by @ngkabra, fixed by tuning
    _nstack_max way down to rock bottom.

0.6.0
-----

  * Licensing now GPL
  * Project hosting moved to github
