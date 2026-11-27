#ifndef _TEXT_INCLUDED_
#define _TEXT_INCLUDED_

#include <sprite.h>
#include <canvas.h>

namespace simplecpp {
class Text : public Sprite {
 protected:
  string message;
 public:
  Text(double cx, double cy, string m, Composite *owner = NULL);
  Text(double cx, double cy, double n, Composite *owner = NULL);
  Text(Composite *owner = NULL);
  void reset(double cx, double cy, string m);
  void reset(double cx, double cy, double m);
  void setMessage(string s);
  void paint(Pose *p = NULL);
};

inline Text::Text(Composite *owner) : Sprite(0, 0, owner) {}
inline Text::Text(double cx, double cy, string m, Composite *owner)
  : Sprite(cx, cy, owner), message(m) {}
inline Text::Text(double cx, double cy, double n, Composite *owner)
  : Sprite(cx, cy, owner) {
  char buf[64];
  snprintf(buf, sizeof(buf), "%g", n);
  message = buf;
}

inline void Text::reset(double cx, double cy, string m) {
  message = m;
  Sprite::reset(cx, cy);
}
inline void Text::reset(double cx, double cy, double m) {
  char buf[64];
  snprintf(buf, sizeof(buf), "%g", m);
  reset(cx, cy, string(buf));
}
inline void Text::setMessage(string s) { message = s; repaint(); }

inline void Text::paint(Pose *p) {
  if (!visible) return;
  ensureCanvas();
  Pose r = p ? Pose(*p, pose) : pose;
  Position o = r.prodPosition(Position(0, 0));
  host::drawText(o.getX(), o.getY(), message.c_str(), color);
}
}
#endif
