#ifndef _TURTLESIM_INCLUDED
#define _TURTLESIM_INCLUDED

#ifndef PI
#define PI 3.14159265358979323846
#endif

#include <turtle.h>

namespace simplecpp {

inline Turtle *_PsystemTurtle_ = NULL;

inline void turtleSim(const char *name = "Turtle Simulator", int w = 500, int h = 500) {
  initCanvas(name, w, h);
  _PsystemTurtle_ = new Turtle;
}

inline void closeTurtleSim() {
  delete _PsystemTurtle_;
  _PsystemTurtle_ = NULL;
  closeCanvas();
}

inline void resetTurtle() {
  if (_PsystemTurtle_) _PsystemTurtle_->Sprite::reset(canvas_width() / 2, canvas_height() / 2);
}

inline double sine(double x) { return sin(PI * x / 180); }
inline double cosine(double x) { return cos(PI * x / 180); }
inline double tangent(double x) { return tan(PI * x / 180); }
inline double arcsine(double x) { return asin(x) * 180 / PI; }
inline double arccosine(double x) { return acos(x) * 180 / PI; }
inline double arctangent(double x) { return atan(x) * 180 / PI; }
inline double arctan(double x) { return arctangent(x); } // common shorthand
inline double arctangent2(double y, double x) { return atan2(y, x) * 180 / PI; }

inline void left(double dist) { if (_PsystemTurtle_) _PsystemTurtle_->left(dist); }
inline void right(double dist) { if (_PsystemTurtle_) _PsystemTurtle_->right(dist); }
inline void forward(double dist) { if (_PsystemTurtle_) _PsystemTurtle_->forward(dist); }
inline void left(int dist) { left((double)dist); }
inline void right(int dist) { right((double)dist); }
inline void forward(int dist) { forward((double)dist); }
inline void penDown(bool state = true) { if (_PsystemTurtle_) _PsystemTurtle_->penDown(state); }
inline void penUp(bool state = true) { if (_PsystemTurtle_) _PsystemTurtle_->penDown(!state); }
inline void hide(bool state = true) {
  if (_PsystemTurtle_) { if (state) _PsystemTurtle_->hide(); else _PsystemTurtle_->show(); }
}
}
#endif
