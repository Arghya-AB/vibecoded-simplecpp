#ifndef _TURTLE_INCLUDED_
#define _TURTLE_INCLUDED_

#include <common_def.h>
#include <sprite.h>
#include <vector>
#include <polygon.h>
#include <canvas.h>

using namespace std;

namespace simplecpp {
class Turtle : public Polygon {
 public:
  Turtle(Composite *owner = NULL);
};

inline Turtle::Turtle(Composite *owner) {
  double pts_body[4][2] = {{0, 15}, {20, 0}, {0, -15}, {0, 15}};
  setColor(COLOR("red"), false);
  setFill();
  penDown();
  reset(canvas_width() / 2.0, canvas_height() / 2.0, pts_body, 4, owner);
}
}
#endif
