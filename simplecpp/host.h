#ifndef _SC_HOST_INCLUDED
#define _SC_HOST_INCLUDED

// Internal bridge between the (unchanged) simplecpp C++ API and the browser.
// Every function here is a WebAssembly import provided by src/runtime.js.
// Keeping the bridge in C++ makes the public headers tiny: no X11 headers and
// no Emscripten specific code ever reach user programs.

namespace simplecpp {

/* Defined in canvas.h; declared early so the sprite headers can use them. */
Color COLOR(const char *color_string);
Color COLOR(unsigned int red, unsigned int green, unsigned int blue);

namespace host {

extern "C" {

__attribute__((import_module("env"), import_name("sc_initCanvas")))
int initCanvas(const char *title, int w, int h);
__attribute__((import_module("env"), import_name("sc_closeCanvas")))
void closeCanvas();
__attribute__((import_module("env"), import_name("sc_canvasWidth")))
int canvasWidth();
__attribute__((import_module("env"), import_name("sc_canvasHeight")))
int canvasHeight();

/* 0 = visible frame, 1 = persistent background. */
__attribute__((import_module("env"), import_name("sc_setTarget")))
void setTarget(int target);
__attribute__((import_module("env"), import_name("sc_clearTarget")))
void clearTarget();
__attribute__((import_module("env"), import_name("sc_beginRepaint")))
void beginRepaint();
__attribute__((import_module("env"), import_name("sc_endRepaint")))
void endRepaint();

__attribute__((import_module("env"), import_name("sc_drawLine")))
void drawLine(double x1, double y1, double x2, double y2, Color color, double width);
__attribute__((import_module("env"), import_name("sc_drawPoint")))
void drawPoint(double x, double y, Color color);
__attribute__((import_module("env"), import_name("sc_drawCircle")))
void drawCircle(double cx, double cy, double r, Color color, int fill, double width);
__attribute__((import_module("env"), import_name("sc_drawEllipse")))
void drawEllipse(double cx, double cy, double w, double h, Color color, int fill, double width);
__attribute__((import_module("env"), import_name("sc_drawPolygon")))
void drawPolygon(const double *points, int count, Color color, int fill, double width);
__attribute__((import_module("env"), import_name("sc_drawText")))
void drawText(double x, double y, const char *text, Color color);
__attribute__((import_module("env"), import_name("sc_textWidth")))
int textWidth(const char *text);
__attribute__((import_module("env"), import_name("sc_textHeight")))
int textHeight();
__attribute__((import_module("env"), import_name("sc_textDescent")))
int textDescent();

__attribute__((import_module("env"), import_name("sc_colorName")))
Color colorName(const char *name);
__attribute__((import_module("env"), import_name("sc_colorRGB")))
Color colorRGB(unsigned int r, unsigned int g, unsigned int b);

/* Milliseconds since program start / cooperative sleep (never blocks the UI). */
__attribute__((import_module("env"), import_name("sc_now")))
double now();
__attribute__((import_module("env"), import_name("sc_sleepMs")))
void sleepMs(double ms);

/* Event queue.  All pointers are optional. */
__attribute__((import_module("env"), import_name("sc_nextEvent")))
int nextEvent(int *type, int *x, int *y, int *keycode, int *state, int *button, char *ch);
__attribute__((import_module("env"), import_name("sc_checkEvent")))
int checkEvent(int *type, int *x, int *y, int *keycode, int *state, int *button, char *ch);
__attribute__((import_module("env"), import_name("sc_discardEvents")))
void discardEvents();

__attribute__((import_module("env"), import_name("sc_echoKey")))
void echoKey(double x, double y, const char *ch, Color color);
__attribute__((import_module("env"), import_name("sc_spriteStatus")))
void spriteStatus(int count);
__attribute__((import_module("env"), import_name("sc_abort")))
void abortProgram();

} /* extern "C" */
} /* namespace host */
} /* namespace simplecpp */

#endif
