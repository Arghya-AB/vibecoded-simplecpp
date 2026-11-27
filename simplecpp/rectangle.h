#ifndef _RECTANGLE_INCLUDED_
#define _RECTANGLE_INCLUDED_

#include <polygon.h>
#include <canvas.h>

namespace simplecpp {
class Rectangle : public Polygon {
 protected:
  double width, height;
  void build();
 public:
  Rectangle(double cx, double cy, double w, double h = -1, Composite *owner = NULL);
  Rectangle(Composite *owner = NULL);
  void init(double cx, double cy, double w, double h = -1, Composite *owner = NULL);
  void reset(double cx, double cy, double w, double h = -1, Composite *owner = NULL);
  double getWidth();
  double getHeight();
};

inline void Rectangle::build() {
  if (width < 0) width = 10;
  if (height < 0) height = width;
  double hw = width / 2, hh = height / 2;
  double pts[4][2] = {
    { -hw, -hh }, { -hw, hh }, { hw, hh }, { hw, -hh }
  };
  Polygon::reset(pose.X(), pose.Y(), pts, 4);
}

inline Rectangle::Rectangle(double cx, double cy, double w, double h, Composite *owner)
  : Polygon(cx, cy, NULL, 0, owner), width(w), height(h) {
  build();
}

inline Rectangle::Rectangle(Composite *owner)
  : Polygon(owner), width(0), height(0) { build(); }

inline void Rectangle::init(double cx, double cy, double w, double h, Composite *owner) {
  reset(cx, cy, w, h, owner);
}

inline void Rectangle::reset(double cx, double cy, double w, double h, Composite *owner) {
  width = w;
  height = h;
  Polygon::reset(cx, cy, NULL, 0, owner);
  build();
}

inline double Rectangle::getWidth() { return width; }
inline double Rectangle::getHeight() { return height; }
}
#endif
