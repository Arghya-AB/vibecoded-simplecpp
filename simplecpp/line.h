#ifndef _LINE_INCLUDED_
#define _LINE_INCLUDED_

#include <sprite.h>
#include <common_def.h>
#include <canvas.h>

namespace simplecpp {
class Line : public Sprite {
 protected:
  Position vertex[2];
  double thickness;
 public:
  Line(Composite *owner = NULL);
  Line(double x1, double y1, double x2, double y2, Composite *owner = NULL);

  void init(double x1, double y1, double x2, double y2);
  void reset(double x1, double y1, double x2, double y2);
  void paint(Pose *p = NULL);
  Position getStart(Pose *p = NULL);
  Position getEnd(Pose *p = NULL);

  void setThickness(double value = 0);
  double getThickness();
};

inline void Line::reset(double x1, double y1, double x2, double y2) {
  pose = Pose((x1 + x2) / 2, (y1 + y2) / 2);
  double dx = (x1 - x2) / 2;
  double dy = (y1 - y2) / 2;
  vertex[0] = Position(dx, dy);
  vertex[1] = Position(-dx, -dy);
  thickness = 2;
  show();
}

inline void Line::init(double x1, double y1, double x2, double y2) { reset(x1, y1, x2, y2); }

inline Line::Line(Composite *owner) : Sprite(0, 0, owner) { init(0, 0, 0, 0); }

inline Line::Line(double x1, double y1, double x2, double y2, Composite *owner)
  : Sprite((x1 + x2) / 2, (y1 + y2) / 2, owner) {
  init(x1, y1, x2, y2);
}

inline void Line::paint(Pose *p) {
  if (!visible) return;
  ensureCanvas();
  XPoint xpt[2];
  if (p) {
    Pose r = Pose(*p, pose);
    r.compute_res_vertex(xpt, vertex, 2);
  } else {
    pose.compute_res_vertex(xpt, vertex, 2);
  }
  host::drawLine(xpt[0].x, xpt[0].y, xpt[1].x, xpt[1].y, color, (int)thickness);
}

inline void Line::setThickness(double value) {
  if (value > 0) { thickness = value; paint(); }
}
inline double Line::getThickness() { return thickness; }

inline Position Line::getStart(Pose *p) {
  return p ? Pose(*p, pose).prodPosition(vertex[0]) : pose.prodPosition(vertex[0]);
}
inline Position Line::getEnd(Pose *p) {
  return p ? Pose(*p, pose).prodPosition(vertex[1]) : pose.prodPosition(vertex[1]);
}
}
#endif
