#ifndef _POINT_INCLUDED_
#define _POINT_INCLUDED_

#include <sprite.h>
#include <vector>
#include <canvas.h>

namespace simplecpp {
class Circle : public Sprite {
 protected:
  double radius;
 public:
  Circle(Composite *owner = NULL);
  Circle(const double x, const double y, const double radius = 10,
         Composite *owner = NULL);
  double getRadius();
  void init(const double x, const double y, const double radius = 10,
            bool repaintP = true);
  void reset(const double x, const double y, const double radius = 10,
             bool repaintP = true);
  virtual void paint(Pose *p = NULL);
};

inline Circle::Circle(Composite *owner) : Sprite(0, 0, owner) {
  radius = 0;
  show();
}

inline Circle::Circle(const double x, const double y, const double r, Composite *owner)
  : Sprite(x, y, owner) {
  init(x, y, r);
}

inline double Circle::getRadius() { return radius; }

inline void Circle::reset(const double x, const double y, const double r, bool repaintP) {
  pose = Pose(x, y);
  radius = r;
  if (repaintP) show();
}

inline void Circle::init(const double x, const double y, const double r, bool repaintP) {
  reset(x, y, r, repaintP);
}

inline void Circle::paint(Pose *p) {
  if (!visible) return;
  ensureCanvas();
  Pose r = p ? Pose(*p, pose) : pose;
  Position o = r.prodPosition(Position(0, 0));
  double s = r.getScale();
  host::drawCircle(o.getX(), o.getY(), radius * s, color, fill ? 1 : 0, 2);
}
}
#endif
