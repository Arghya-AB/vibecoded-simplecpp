#ifndef _SPRITE_INCLUDED_
#define _SPRITE_INCLUDED_

#include <spriteInterface.h>
#include <common_def.h>
#include <pose.h>
#include <host.h>
#include <x11_compat.h>

namespace simplecpp {

class Composite;

/* Provided by canvas.h (declared here so Sprite can stay header-only). */
void addSprite(Sprite *t);
void addPartToOwner(Composite *owner, Sprite *part);
void removeSprite(Sprite *t);
void c_imprint(Sprite *s);
void repaint();
void beginFrame();
void endFrame();
void imprintLine(short x1, short y1, short x2, short y2,
                 Color line_color = COLOR(0,0,0), unsigned int line_width = 2);

class Sprite : public virtual SpriteInterface {
 protected:
  float z_index;
  inline static float max_z_index = 0;
  Pose pose;
  bool visible;
  Color color;
  bool fill;
  void init(Composite *owner);
  bool penIsDown;
 public:
  Sprite(const Sprite &other);
  Sprite &operator=(const Sprite &other);
  Sprite(Composite *owner = NULL);
  Sprite(double dx, double dy, Composite *owner = NULL);
  virtual ~Sprite();
  void reset(double dx, double dy, Composite *owner = NULL);

  virtual void forward(double distance);
  virtual void penDown(bool down = true);
  virtual void penUp(bool up = true);
  virtual void left(double Dangle) { rotate(-Dangle * PI / 180); }
  virtual void right(double Dangle) { rotate(Dangle * PI / 180); }
  virtual double getX() const { return pose.X(); }
  virtual double getY() const { return pose.Y(); }
  virtual double getOrientation() const { return pose.getOrientation(); }
  virtual double getScale() const { return pose.getScale(); }

  virtual void paint(Pose *p = NULL) {}
  virtual void show();
  virtual void hide();
  virtual void rotate(double angle);
  virtual void face(Sprite &s);
  virtual void face(double x, double y, bool repaintP = true);
  virtual void setScale(double factor, bool repaintP = true);
  virtual void scale(double factor, bool repaintP = true);
  virtual void move(double xshift, double yshift, bool repaintP = true);
  virtual void moveTo(double x, double y, bool repaintP = true);
  virtual void print(string msg = "") { cout << msg << " Undefined.\n"; }
  Sprite &setColor(Color c, bool repaintP = true);
  void setFill(bool v = true, bool repaintP = true);
  void imprint(bool repaintP = true);
  virtual Position getOrigin() const { return pose.getOrigin(); }
  virtual void setZIndex(float new_z_index);
  virtual float getZIndex() const { return z_index; }
  virtual Position getAtan2() const { return pose.getAtan2(); }
};

inline Sprite::Sprite(Composite *owner) { init(owner); }
inline Sprite::Sprite(double dx, double dy, Composite *owner) : pose(dx, dy) { init(owner); }

inline void Sprite::init(Composite *owner) {
  visible = true;
  color = COLOR("black");
  fill = false;
  penIsDown = false;
  z_index = ++max_z_index;
  if (owner) addPartToOwner(owner, this);
  else addSprite(this);
}

inline Sprite::Sprite(const Sprite &other)
  : z_index(other.z_index), pose(other.pose), visible(other.visible),
    color(other.color), fill(other.fill), penIsDown(other.penIsDown) {
  addSprite(this);
}

inline Sprite &Sprite::operator=(const Sprite &other) {
  hide();
  z_index = other.z_index;
  pose = other.pose;
  visible = other.visible;
  color = other.color;
  fill = other.fill;
  penIsDown = other.penIsDown;
  return *this;
}

inline Sprite::~Sprite() { removeSprite(this); }

inline void Sprite::reset(double dx, double dy, Composite * /*owner*/) {
  pose = Pose(dx, dy);
  repaint();
}

inline void Sprite::show() { visible = true; repaint(); }
inline void Sprite::hide() { visible = false; repaint(); }

inline void Sprite::rotate(double angle) {
  pose = Pose(pose, Pose(angle));
  repaint();
}

inline void Sprite::setScale(double factor, bool repaintP) {
  pose.setScale(factor);
  if (repaintP) repaint();
}

inline void Sprite::scale(double factor, bool repaintP) {
  pose = Pose(pose, Pose(factor, true));
  if (repaintP) repaint();
}

inline void Sprite::moveTo(double x, double y, bool repaintP) {
  Position oldorigin = pose.getOrigin();
  move(x - oldorigin.getX(), y - oldorigin.getY(), repaintP);
}

inline void Sprite::move(double xshift, double yshift, bool repaintP) {
  Position oldorigin = pose.getOrigin();
  pose = Pose(Pose(xshift, yshift), pose);
  if (penIsDown) {
    imprintLine((short)oldorigin.x, (short)oldorigin.y,
                (short)(oldorigin.x + xshift), (short)(oldorigin.y + yshift),
                COLOR(0,0,0), 2);
  }
  if (repaintP) repaint();
}

inline void Sprite::setFill(bool v, bool repaintP) {
  fill = v;
  if (repaintP) repaint();
}

inline Sprite &Sprite::setColor(Color c, bool repaintP) {
  color = c;
  if (repaintP) repaint();
  return *this;
}

inline void Sprite::imprint(bool repaintP) {
  c_imprint(this);
  if (repaintP) repaint();
}

inline void Sprite::forward(double distance) {
  Position image = pose.unitX();
  move(image.getX() * distance, image.getY() * distance);
}

inline void Sprite::penDown(bool down) { penIsDown = down; }
inline void Sprite::penUp(bool up) { penIsDown = !up; }

inline void Sprite::face(double x, double y, bool /*repaintP*/) {
  Position image = pose.unitX();
  double angle = atan2(image.getY(), image.getX());
  Position origin = getOrigin();
  double target = atan2(y - origin.getY(), x - origin.getX());
  rotate(target - angle);
}

inline void Sprite::face(Sprite &s) {
  Position org = s.getOrigin();
  face(org.getX(), org.getY());
}

inline void Sprite::setZIndex(float new_z_index) {
  beginFrame();
  removeSprite(this);
  z_index = new_z_index;
  addSprite(this);
  endFrame();
}

}
#endif
