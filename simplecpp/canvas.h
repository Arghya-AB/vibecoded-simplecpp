#ifndef _CANVAS_INCLUDED
#define _CANVAS_INCLUDED

#include <algorithm>
#include <cstdlib>
#include <set>
#include <string>
#include <vector>

#include <common_def.h>
#include <x11_compat.h>
#include <host.h>
#include <pose.h>
#include <sprite.h>

namespace simplecpp {

inline int screen_width = 500;
inline int screen_height = 500;
inline bool canvas_initialized = false;
inline bool globalRepaintFlag = true;

struct LtSprite {
  bool operator()(const Sprite *s1, const Sprite *s2) const {
    return s1->getZIndex() < s2->getZIndex();
  }
};
inline std::multiset<Sprite *, LtSprite> spriteSet;

inline double randuv(double u, double v) {
  return u + (v - u) * rand() / (1.0 + RAND_MAX);
}
inline void abort() { host::abortProgram(); }
inline int canvas_width() { return screen_width; }
inline int canvas_height() { return screen_height; }

inline void wait(float duration) {
  double end = host::now() + (double)duration * 1000.0;
  while (host::now() < end) host::sleepMs(std::min(20.0, end - host::now()));
}

inline int initCanvas(const char window_title[] = "Simplecpp Canvas",
                      int w = 500, int h = 500) {
  if (w == -1) { w = host::canvasWidth(); h = host::canvasHeight(); }
  screen_width = w;
  screen_height = h;
  int rc = host::initCanvas(window_title, w, h);
  canvas_initialized = true;
  host::setTarget(1);
  host::clearTarget();
  host::beginRepaint();
  host::endRepaint();
  return rc;
}

inline void ensureCanvas() { if (!canvas_initialized) initCanvas(); }

inline void closeCanvas() {
  host::closeCanvas();
  canvas_initialized = false;
  spriteSet.clear();
}

inline Color COLOR(const char *color_string) { return host::colorName(color_string); }
inline Color COLOR(unsigned int red, unsigned int green, unsigned int blue) {
  return host::colorRGB(red, green, blue);
}

inline void addSprite(Sprite *t) {
  ensureCanvas();
  if (t) spriteSet.insert(t);
}

inline void removeSprite(Sprite *t) {
  if (t) {
    for (auto iter = spriteSet.begin(); iter != spriteSet.end(); ++iter) {
      if (*iter == t) { spriteSet.erase(iter); break; }
    }
  }
  repaint();
}

inline void beginFrame() { globalRepaintFlag = false; }
inline void endFrame() { globalRepaintFlag = true; repaint(); }

inline void repaint() {
  if (!globalRepaintFlag || !canvas_initialized) return;
  host::beginRepaint();
  host::setTarget(0);
  for (auto iter = spriteSet.begin(); iter != spriteSet.end(); ++iter)
    (*iter)->paint();
  host::setTarget(0);
  host::endRepaint();
}

inline void c_imprint(Sprite *s) {
  ensureCanvas();
  if (!s) return;
  host::setTarget(1);
  s->paint();
  host::setTarget(0);
}

inline void imprintLine(short x1, short y1, short x2, short y2,
                        Color line_color, unsigned int line_width) {
  ensureCanvas();
  host::setTarget(1);
  host::drawLine(x1, y1, x2, y2, line_color, line_width);
  host::setTarget(0);
}

inline void drawLine(XPoint start, XPoint end, Color line_color,
                     unsigned int line_width = 0) {
  ensureCanvas();
  host::drawLine(start.x, start.y, end.x, end.y, line_color, line_width);
}

inline void drawPoint(XPoint point, Color point_color, int /*function*/ = GXcopy) {
  ensureCanvas();
  host::drawPoint(point.x, point.y, point_color);
}

inline void drawCircle(XPoint centre, int radius, Color fill_color,
                       bool fill = true, unsigned int line_width = 0,
                       int /*line_style*/ = LineSolid, int /*cap_style*/ = CapButt,
                       int /*join_style*/ = JoinMiter, int /*function*/ = GXcopy) {
  ensureCanvas();
  host::drawCircle(centre.x, centre.y, radius, fill_color, fill ? 1 : 0, line_width);
}

inline void drawEllipse(XPoint centre, int width, int height, Color fill_color,
                        bool fill = true, unsigned int line_width = 1,
                        int /*line_style*/ = LineSolid, int /*cap_style*/ = CapButt,
                        int /*join_style*/ = JoinMiter, int /*function*/ = GXcopy) {
  ensureCanvas();
  host::drawEllipse(centre.x, centre.y, width, height, fill_color,
                    fill ? 1 : 0, line_width);
}

inline void drawPolygon(XPoint *points, int npoints, Color fill_color,
                        bool fill = true, unsigned int line_width = 0,
                        int /*line_style*/ = LineSolid, int /*cap_style*/ = CapButt,
                        int /*join_style*/ = JoinMiter, int /*fill_rule*/ = WindingRule,
                        int /*function*/ = GXcopy) {
  ensureCanvas();
  if (!points || npoints <= 0) return;
  vector<double> pts;
  pts.reserve(npoints * 2);
  for (int i = 0; i < npoints; i++) {
    pts.push_back(points[i].x);
    pts.push_back(points[i].y);
  }
  host::drawPolygon(pts.data(), npoints, fill_color, fill ? 1 : 0, line_width);
}

inline int textWidth(string text) { return host::textWidth(text.c_str()); }
inline int textWidth(char op) { return textWidth(string(1, op)); }
inline int textHeight() { return host::textHeight(); }
inline int textDescent() { return host::textDescent(); }

inline void drawText(float x, float y, string text, Color clr) {
  ensureCanvas();
  host::drawText(x, y, text.c_str(), clr);
}

inline void drawText(XPoint position, string message, Color clr) {
  drawText(position.x, position.y, message, clr);
}

/* ---- events ---------------------------------------------------------- */

// Events that arrived while getClick() was waiting (for example a key press)
// are kept here so the following checkEvent() can still see them.
inline std::vector<XEvent> queuedEvents;

inline void fillEventFields(XEvent &event) {
  event.xbutton.x = event.xkey.x;
  event.xbutton.y = event.xkey.y;
  event.xmotion.x = event.xkey.x;
  event.xmotion.y = event.xkey.y;
  event.xmotion.state = event.xkey.state;
  event.xbutton.state = event.xkey.state;
}

inline void rawNextEvent(XEvent &event) {
  host::nextEvent(&event.type, &event.xkey.x, &event.xkey.y,
                  &event.xkey.keycode, &event.xkey.state,
                  &event.xbutton.button, event.xbutton.chars);
  fillEventFields(event);
}

inline bool rawCheckEvent(XEvent &event) {
  int ok = host::checkEvent(&event.type, &event.xkey.x, &event.xkey.y,
                            &event.xkey.keycode, &event.xkey.state,
                            &event.xbutton.button, event.xbutton.chars);
  if (!ok) return false;
  fillEventFields(event);
  return true;
}

inline void nextEvent(XEvent &event) {
  if (!queuedEvents.empty()) {
    event = queuedEvents.front();
    queuedEvents.erase(queuedEvents.begin());
    return;
  }
  rawNextEvent(event);
}

inline bool checkEvent(XEvent &event) {
  if (!queuedEvents.empty()) {
    event = queuedEvents.front();
    queuedEvents.erase(queuedEvents.begin());
    return true;
  }
  return rawCheckEvent(event);
}

inline bool mouseDragEvent(XEvent &event) { return event.type == MotionNotify; }
inline bool keyPressEvent(XEvent &event) { return event.type == KeyPress; }
inline bool mouseButtonPressEvent(XEvent &event) { return event.type == ButtonPress; }
inline bool mouseButtonReleaseEvent(XEvent &event) { return event.type == ButtonRelease; }
inline char charFromEvent(XEvent &event) { return event.xbutton.chars[0]; }

inline void echoKey(XEvent &event, Color clr = COLOR(0,0,255)) {
  char c = charFromEvent(event);
  int tw = textWidth(c);
  drawText(event.xkey.x + tw / 2.0f, event.xkey.y, string(1, c), clr);
}

inline void spriteStatus() { host::spriteStatus((int)spriteSet.size()); }

inline int getClick() {
  ensureCanvas();
  // Stale events are cleared once at the start of each run (see worker.js).
  // Do not discard here: a key or click sent just after the prompt must count.
  queuedEvents.clear();
  while (true) {
    XEvent event;
    rawNextEvent(event);
    if (event.type == ButtonPress) return event.xbutton.x * 65536 + event.xbutton.y;
    // Do not swallow other events; checkEvent() should still be able to read
    // a key press made while the program was waiting for the click.
    queuedEvents.push_back(event);
  }
}

}
#endif
