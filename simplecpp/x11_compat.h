#ifndef _SC_X11_COMPAT_INCLUDED
#define _SC_X11_COMPAT_INCLUDED

// The original simplecpp talks to an X11 server.  In the browser port the
// small part of the X11 vocabulary that is part of the *user visible* API is
// kept here, so existing programs compile unchanged.  The actual drawing is
// done by JavaScript (see src/graphics.js).

struct XPoint {
  short x;
  short y;
};

struct XKeyEvent {
  int type;
  unsigned long serial;
  int x, y;
  int keycode;
  int state;
};

struct XButtonEvent {
  int type;
  unsigned long serial;
  int x, y;
  int button;
  int state;
  char chars[8];
};

struct XMotionEvent {
  int type;
  unsigned long serial;
  int x, y;
  int state;
};

struct XExposeEvent {
  int type;
  unsigned long serial;
  int x, y, width, height;
};

union XEvent {
  int type;
  XKeyEvent xkey;
  XButtonEvent xbutton;
  XMotionEvent xmotion;
  XExposeEvent xexpose;
};

/* Event types (same numeric values as X11). */
#define KeyPress       2
#define KeyRelease     3
#define ButtonPress    4
#define ButtonRelease  5
#define MotionNotify   6
#define Expose        12

/* Graphics context constants used in the published simplecpp API. */
#define GXcopy       3
#define GXxor        6
#define LineSolid    0
#define LineOnOffDash 1
#define LineDoubleDash 2
#define CapButt      0
#define CapNotLast   1
#define CapRound     2
#define CapProjecting 3
#define JoinMiter    0
#define JoinRound    1
#define JoinBevel    2
#define WindingRule  1
#define EvenOddRule  0
#define Complex      3

#endif
