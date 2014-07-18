Pigshell User Guide
=======================

Introduction
------------

[_Pigshell_](http://pigshell.com) is a pure client-side Javascript app running
in the browser, which presents resources on the web as files.  These include
public web pages as well as private data in Google Drive, Dropbox, Facebook and
even the desktop. It provides a command line interface to construct pipelines
of simple commands to transform, display and copy data.

**_Pigshell_ is open source software**, released under the GNU GPLv3.

The _pigshell_ system is similar in spirit to Unix and _bash_, but also borrows
several ideas from Plan 9 and `rc`, mixing syntax and features in a manner
calculated to annoy experienced users of both systems.

The name _pigshell_ comes from the time-honoured tradition of weak puns and
recursive acronyms: **GNU**'s **N**ot **U**nix, and **PIG** **I**sn't
**GNU**.

Shells and shell scripts occupy an important niche in the Unix users' universe:
they can quickly assemble ad-hoc tools from simple components to interact with
their data. For complex applications, they might open the editor and write a
program, but for hundreds of simple operations, the humble shell suffices.

There is no equivalent in the world of the web and the cloud, though an
increasing amount of our data resides there. One is forced to go through GUIs,
each with their individual warts and annoyances. Imagine having to open a
different GUI application every time you accessed a different disk, with no way
to directly copy from one disk to the other.

The web abounds in APIs, but there is no easy way to connect half a dozen
random APIs together without reading up a ton of API documents and do a fair
amount of data normalization, coding and debugging before getting the first
trickle of data to go from point A to B.

_Pigshell_ is a place to have informal conversations with data.

In this document, we describe the different components of the system, their
main features and examples of usage. In addition, we will also point out
the more prominent gotchas, unimplemented features and bugs.

Broadly, _Pigshell_ consists of the following:

1. The shell itself.
2. Built-in commands.
3. Filesystems, to represent resources from various data providers as filesystems.

Shell
-----

The shell is designed to be feel familiar to Unix and _bash_ users, but there
are crucial differences. The most important of these are:

1. Objects are the fundamental currency of the system. Objects are passed
   across pipes, rather than streams of unstructured data. The web 
   environment frequently returns structured objects, and there is no point in
   losing that structure and recovering it in every other stage of the pipeline.
2. A _pigshell_ pipeline lazily processes streams of _objects_. Commands
   should be considered as generator functions yielding objects, composed using
   the pipe operator. The pipeline starts when the last member (an implicit
   `Stdout`) asks the upstream command for the next object, which in turn
   asks its upstream command and so on, until the command at the head
   reluctantly yields an object. It is processed and "returned" downstream,
   until it hits `Stdout` which displays it on the terminal. `Stdout` has an
   insatiable appetite for objects, so it asks for one more, and the process
   continues until a `null` object, signifying the end of the stream, makes
   its way down. Unlike Unix commands, _pigshell_ commands are _not_
   independently executing processes.
3. The pipeline is the fundamental unit of "process management". You can kill,
   stop, resume pipelines of commands, rather than individual commands
   themselves.

### Terminal usage ###

The shell presents itself as a terminal with a command line.
Emacs-style command line editing is possible. Common shortcuts include:

*  **Ctrl-A**, **Ctrl-E**: Go to the beginning or end of line.
*  **Ctrl-U**, **Ctrl-K**: Kill text up to the beginning or end of line.
*  **Ctrl-W**: Kill previous word.
*  **Ctrl-L**: Clear screen.
*  **Up arrow**, **Down arrow**: Navigate through command history.
*  **Ctrl-D**: End of input.

The primary prompt consists of `pig<basename_of_cwd>$`.
When you type a command at the primary prompt and hit _Enter_, it starts
running immediately. This is the _foreground command_. A secondary prompt of
`> ` is displayed.

You can use this prompt to typeahead another command, which will be executed
after the foreground command completes. You can queue multiple commands in this
way, and they will be executed in strict sequence.

To kill the foreground command, use **Ctrl-C**. This also triggers the running
of the next queued command, if any.

Similarly, to pause the foreground command and continue with any queued
commands, use **Ctrl-Z**. The paused command can be resumed using `ps` and
`start`.

You may use **Ctrl-B** to "background" the foreground command and start running
the next queued command. This is typically done when the foreground command
is going to run for several seconds, and the queued command is not dependent
on its predecessor.

The output of commands is restricted to an (elastic) area below the command
line. Thus, many commands may be running and generating output at the same
time without stomping over each other, maintaining the question-answer
structure of the command line conversation.

This also means that multiple commands may be waiting for input, as indicated
by blinking cursors. Simply click next to the cursor to switch focus.

The running status of a pipeline is visually indicated by the colour of the
prompt.

*  A green prompt indicates that the command is running,
*  Amber indicates that it is stopped
*  Black indicates that it has completed with a successful exit status.
*  Red indicates that it has completed with an unsuccessful exit status.

**Reloading the webpage is equivalent to rebooting the system and the loss
of all local state.** Only files stored in /local and filesystems backed by
a persistent remote store (e.g. PstyFS, Google) will survive a reboot.

> &#3232;\_&#3232; _Occasionally, things may get buggered up to the point that
> there is no cursor visible anywhere. In such cases, simply click near the
> last prompt and you should get focus there, and resume typing commands._
>
> &#3232;\_&#3232; _Cut and paste is also somewhat iffy._

### Simple commands ###

    ls | sum
    echo able baker charlie >/tmpfile
    echo some more >>/tmpfile
    ls A*
    ls *.jpg
    cat bar | grep foo >/dev/null && echo "bar contains foo"
    cat < asd > bsd
    rm somefile || echo rm failed!

### Escaping arguments ###

*  To quote an argument containing spaces or special characters, it must be
   enclosed in single or double quotes. There is no difference between the two.
   Variable interpolation is _not_ done for arguments in double quotes.
*  Arguments with one type of quote may be enclosed in the other, e.g.
   "Patrick O'Brian" and 'Benjamin "Bugsy" Siegel'.
*  Backslashes may be used to escape special characters in unquoted strings.

### Variables ###

_Pigshell_ variables are lists of objects. Most commonly, they are lists of
strings. Variables may be assigned values in the usual manner:

`msg="How's it going?"`  
`dirs=(/facebook /twitter /gdrive)`

Parentheses are used to enclose lists. The variable `dirs` is thus assigned a
list of two strings. `msg` is a list containing one string.

Lists are expanded on reference.  
`echo $dirs`  
would yield  
`/facebook /twitter /gdrive`  
The `echo` command is invoked with two arguments.

To add to a list,  
`dirs=($dirs /picasa)`  
`echo $dirs`  
would give  
`/facebook /twitter /gdrive /picasa`

Variables may be subscripted by a list of numbers (or a list of expressions
yielding numbers) to retrieve part of the list. List indexing starts at zero.
For example,  
`index=0`  
`echo $dirs($index 2 $index)`  
would give  
`/facebook /gdrive /facebook`  

The number of elements in the variable `dirs` can be found using `$#dirs`.

One can do the equivalent of an `array.join(' ')` using the `$"` operator.  
`words=(Holy Plan9 Ripoff Batman)`  
`sent=$"words`  
`echo $words` and `echo $sent` will both print  
`Holy Plan9 Ripoff Batman`  

Note that  
`echo $#words $#sent` will print   
`4 1`  

Referring to a nonexistent variable yields nothing, referring to its
length gives 0, and `$"nonexistent` gives the empty string. Therefore, when
unsure of a variable's existence, it is better to use `[ $"foo = "bar" ]`,
which is equivalent to `[ "" = "bar" ]`, while `[ $foo = "bar" ]` would expand
to `[ = "bar" ]` which would throw an error.

### Variable Scope ###

1.  **Local Scope:** Positional variables (`$1`, `$2`... `$*`) and
    variables whose names begin with an underscore (e.g. `_i`, `_foo`) are
    local to the enclosing function or shell.

2.  **Global Scope:** All other variables are global to the shell, and may
    be freely referenced and set inside functions.

3.  **Exports:** There is no notion of `export`, copies of all global
    variables are inherited by a child shell from its parent. Changing a
    variable in a child will not affect the value in the parent.

### Concatenation ###

Arguments may be concatenated using the `^` operator. In most cases, it is
not necessary, since _pigshell_ will automatically concatenate arguments which
adjoin each other without any intervening whitespace. For example, in the
command  
`able=able; baker=baker; echo "able"baker able'baker' "able"'baker' able$baker $able^baker $able$baker`  
`echo` has 6 arguments, each of which is `ablebaker`. Note that a caret was
only required to resolve ambiguity in one case.

The rules for concatenating lists are as follows:

1. Concatenation is a left-binding operator. i.e. `a^b^c` is parsed as `(a^b)^c`
2. Concatenation operates on strings. List elements are coerced into strings
   using the `toString()` method before concatenation.
2. An empty list A concatenated with a list B will yield B.
3. A list A with a single element concatenated with B will yield a list where
   A(0) is concatenated with every element of B.  
   `a=able; b=(1 2 3)`  
   `echo $a$b` gives  
   `able1 able2 able3`  
   `echo $b$a` gives  
   `1able 2able 3able`
4. If lists A and B have the same number of elements, the result is a list of
   strings concatenated pairwise.  
   `a=(able baker charlie); b=(1 2 3)`  
   `echo $a$b` gives  
   `able1 baker2 charlie3`  
5. Lists not conforming to any of the above rules cannot be concatenated.

### Command substitution ###

Command substitution allows the standard output of a command to be converted
into an expression, which may be used as a command argument or assigned to a
variable. _Pigshell_ supports only the `$(command)` form, not the backtick
form. For example,  
`files=$(ls)`  
`nfiles=$(ls | sum)`  
`echo "Number of files: " $(ls | sum)`

Note that `files` contains a list of _file objects_. Command substitution is
the easiest way to get objects into variables.

Command substitutions may be nested:  
`echo $(printf -s $format $i $(cat $i/status) $(cat $i/cmdline))`  

### Deferred pipeline ###

Deferred pipelines are created using the `${<command1> | <command2>... }`
syntax. The pipeline is created and assembled but not run. The expression
yields an object, which can be stored in variable, or used as an argument to
another command. The `next` command, with this object as an argument, can be
used to crank the pipeline to produce one object. Further invocations of the
`next` command produce subsequent items in the stream, until EOF is reached,
after which the EPIPE error is returned.

To run the deferred pipeline to completion and get all the objects in the
stream in one shot, `cat` can be used.

`p=${echo foo; echo bar}`<br>
`next $p` gives<br>
`foo`<br>
A further `next $p` gives<br>
`bar`<br>
Running `next $p` again results in EOF. Any further invocations of `next $p` return an EPIPE error.

Alternately,<br>
`cat $p` gives<br>
`foo`<br>
`bar`

### Control Flow - if ###

The syntax of the `if` construct is very similar to _bash_.  
`if` _cond_`; then `_tcmd_... `[; elif ` _cond_`; then `_tcmd_... `]` `[; else ` _ecmd_... `]; fi`

If the exit value of the _cond_ command is `true`, we enter the `then` clause.
Any exit value other than `true` is considered false. Commands may be spread
over multiple lines, like in _bash_.

### Control Flow - for ###

`for` loops are also similar to _bash_.  
`for i in `_list_ `; do `_cmd_...`; done`  

### Control Flow - while ###

`while` loops are, again, similar to _bash_.  
`while `_cond_`; do `_cmd_...`; done`

### Functions ###

Functions can be defined as follows:  
`function` _funcname_ `{` _cmd_.. `}`

Functions behave like inline scripts in how they are invoked, how arguments
are accessed within the body, and their ability to be part of pipelines.  
`funcname arg1 arg2`  
`funcname arg1 arg2 | grep foo`

Arguments are accessed within the body of the function using positional
arguments, `$0...$n` and `$*`.

All global variables accessed, defined and modified in the body of a function
are part of the global scope of the enclosing shell. Variables whose names
begin with an underscore are local to the function.

Function definitions may be deleted using  
`function` _funcname_  
with no body. Note that this is different from `function` _funcname_ `{}`,
which is a function with an empty body.

### Command Execution ###

To execute a command, _pigshell_ searches within its builtins and the paths in
the variable PATH for a match, in that order. If a command contains a path
separator, then it is looked up directly in the filesystem without going
through the search process. In case the PATH variable is not set, `/bin/` is
assumed to the default path.

Note that PATH, like other _pigshell_ variables, is a list. It must be set
using the list syntax, i.e. `PATH=(/bin /usr/bin)`

### Special Variables ###

The following special variables are maintained by _pigshell_:

1. **`$0, $1.. $n`, `$*`, `$#`**: These variables are used inside a script
   to determine individual arguments to the script, the list of arguments, and
   the number of arguments respectively.
2. **`$?`**: Exit value of the last command. `true` for successful commands.
3. **`$!`**: PID of the latest executed pipeline.

Built-in Commands
-----------------

_Pigshell_ has a large number of built-in commands. These commands are
implemented in Javascript and have access to all the internal APIs and
filesystems. Many of these commands follow a common set of idioms.

1. All builtin commands may be listed by the `help` command. Specific usage
   of a given command, say, `grep`, may be obtained either using `help grep`
   or `grep -h`. All builtins support the `-h` option.
2. All pipelines have an implicit `Stdin` and `Stdout` "command" at the head
   and tail respectively. Objects which reach `Stdout` are displayed according
   to their type. Objects like files have an `html` attribute which is
   used to render them to the output div.
3. Filter commands like `grep` and `printf` take in files, filter or
   transform them, and emit objects to `Stdout`. These commands can be
   supplied with files in one of two ways:

   1. As a list of arguments, corresponding to the `<file>...` option given
      in the usage. These arguments may be strings representing file paths,
      actual File objects, or a mixture of both. e.g.

      `grep -f gender "female" /facebook/friends/*`  
      `grep -f gender "female" /facebook/friends/A* $close_friends` where the
      `close_friends` variable a list of File objects.
   2. As a list of File objects from `Stdin`. e.g.

      `ls /facebook/friends | grep -f gender "female"`  
      `echo $close_friends | grep -f gender "female"`

   If you accidentally fail to give either of these, a line with a blinking
   cursor will open up below the command. This is `Stdin` trying to get input
   from the terminal. Typing into this line and pressing _Enter_ will feed a
   string to the command. To indicate end of input, type **Ctrl-D**. To
   simply get out, click to the right of the latest shell prompt to move
   focus there.
4. Many commands which operate on objects have options to specify or extract
   attributes from the object.

   1. The `-f` option is commonly used to refer to a field in the object. For
      instance, File objects correponding to Facebook friends have attributes
      like `gender`, `friend_count`, etc. You can thus

      `ls /facebook/friends | grep -f gender "^male"`   
      `ls /facebook/friends | sort -f friend_count`  
      to use those specific fields for filtering or sorting.

      You can access nested attributes as well:

      `ls /facebook/friends | grep -f raw.relationship_status single`
   2. The `-e` option can be used to specify a lambda expression in Javascript
      which can be used to combine or filter field values in complex ways.

      `ls /picasa/albums/Blah | sort -e "x.width * x.height"`  
      sorts photos based on how many pixels they contain. The expression will
      be called with the argument `x` set to the object. `width` and `height`
      are attributes of the object.

### Process Management ###

Pipeline status and control files are exposed in a special /proc filesystem,
so simple scripts in /bin are sufficient to implement process management.

1. **ps**: Lists running pipelines by PID, state and commands.
2. **kill**: Kills one or more pipelines by PID.
3. **stop**: Stops a pipeline. Equivalent to the Unix `kill -STOP`.
4. **start**: Resume a pipeline. Equivalent to the Unix `kill -CONT`.

Filesystems
-----------

_Pigshell_ represents cloud resources and system resources as files.
Filesystems are responsible for maintaining local file objects corresponding
to remote resources. We will briefly go over the filesystems currently 
supported.

**Google**: Supports Picasa and Google Drive. Click the _Connect Google_
button to mount Picasa albums under `/picasa/<email>` and GDrive under
`/gdrive/<email>`.

**Dropbox**: Click the _Connect Dropbox_ button to mount your Dropbox under
`/dropbox/<email>`.

**Facebook**: Click the _Connect Facebook_ button to mount your Facebook
account at `/facebook`. _Pigshell_ is pure client-side, so privacy is
completely assured.

**Download**: Presents a single directory, `/download`. You may copy files
into this directory to download them to the desktop.

**Upload**: Click the _Upload_ button in the right menu and select files.
Alternately, drag and drop files onto the terminal. These files will be
available under `/upload` and can be copied from there to a target directory.

**Proc**: The proc filesystem, mounted at `/proc`, maintains a directory
corresponding to each running pipeline. Each directory has the following
files:

1. **cmdline**: Command line corresponding to the pipe
2. **status**: Read-only, contains one of 'start', 'stop', 'done'.
3. **ctl**: Write-only. Write 'stop' to stop a pipeline, 'start' to resume it,
   'kill' to kill it.

**Lstor**: Mounted at `/local`, this filesystem is backed by HTML5 local
storage. Files stored here will survive "reboots". It is single-level; you
cannot make directories here.

Design Principles
-----------------

_Pigshell_ is inspired by Unix and Plan 9. We are very familiar with several
Unix implementations, but our experience with Plan 9 is purely platonic. We
have tried to retain as much of a `bash` flavour as possible, to make it easy
for experienced Unix users to start using the system and incrementally
discover features, without having to read a long and tedious document like
this one.

There is more than one way to TIMTOWDI: one is characterized by a profusion of
syntactic forms, where one cannot read one's own code after a few weeks. In
another, it emerges from different ways of expressing the same meaning by
combining of a small set of core concepts. _Pigshell_ leans heavily towards
the latter.

The _pigshell_ syntax is intended to be used as a glue language for composing
"tweet"-sized sentences and short scripts. Longer and more elaborate solutions
on the _pigshell_ platform are better written in Javascript.

The _pigshell_ grammar is implemented using a PEG, which is far easier to
specify and debug than BNF. The disadvantage is somewhat poor error reporting.
