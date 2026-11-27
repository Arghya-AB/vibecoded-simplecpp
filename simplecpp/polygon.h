#ifndef _POLYGON_INCLUDED_
#define _POLYGON_INCLUDED_

#include <sprite.h>
#include <vector>
#include <iostream>
#include <canvas.h>

namespace simplecpp {
class Polygon : public Sprite {
 protected:
  vector<Position> vertex;
  void init(const double x, const double y, const double points[][2],
            int count, Composite *owner = NULL);
 public:
  Polygon(Composite *owner = NULL);
  Polygon(const double x, const double y, const double points[][2], int count,
          Composite *owner = NULL);
  void reset(const double x, const double y, const double points[][2],
             int count, Composite *owner = NULL);
  void paint(Pose *p = NULL);
};

inline Polygon::Polygon(Composite *owner) : Sprite(0, 0, owner) {
  init(canvas_width() / 2.0, canvas_height() / 2.0, NULL, 0, owner);
}

inline Polygon::Polygon(const double x, const double y, const double points[][2],
                        int no, Composite *owner) : Sprite(x, y, owner) {
  init(x, y, points, no, owner);
}

inline void Polygon::reset(const double x, const double y,
                           const double points[][2], int no, Composite *owner) {
  vertex.clear();
  for (int iter = 0; iter < no; iter++)
    vertex.push_back(Position(points[iter][0], points[iter][1]));
  Sprite::reset(x, y, owner);
}

inline void Polygon::init(const double x, const double y,
                          const double points[][2], int no, Composite *owner) {
  reset(x, y, points, no, owner);
  show();
}

inline void Polygon::paint(Pose *p) {
  if (!visible || vertex.empty()) return;
  ensureCanvas();
  XPoint xpt_vertex[vertex.size()];
  if (p) {
    Pose r = Pose(*p, pose);
    r.compute_res_vertex(xpt_vertex, vertex, (int)vertex.size());
  } else {
    pose.compute_res_vertex(xpt_vertex, vertex, (int)vertex.size());
  }
  drawPolygon(xpt_vertex, (int)vertex.size(), color, fill);
}
}
#endif
