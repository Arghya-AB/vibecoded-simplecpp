export const EXAMPLES = {
  'Welcome': [
    { name: 'main.cpp', content: `#include <simplecpp>

int main() {
  initCanvas("simplecpp in the browser", 500, 500);

  Circle sun(410, 75, 32);
  sun.setColor(COLOR("orange"));
  sun.setFill();

  Rectangle house(160, 300, 170, 130);
  house.setColor(COLOR("lightblue"));
  house.setFill();

  Line roof1(75, 235, 160, 165);
  Line roof2(160, 165, 245, 235);

  Text title(250, 35, "Hello from simplecpp!");
  title.setColor(COLOR("navy"));

  Turtle t;
  t.penUp();
  t.moveTo(300, 420);
  t.penDown();
  repeat (4) {
    t.forward(70);
    t.right(90);
  }

  cout << "Type your name and press Enter: ";
  string name;
  cin >> name;
  cout << "Hello, " << name << "!" << endl;
  return 0;
}
` },
  ],
  'Turtle art': [
    { name: 'main.cpp', content: `#include <simplecpp>

int main() {
  turtleSim("Turtle art", 500, 500);
  penDown();
  repeat (36) {
    forward(140);
    right(170);
  }
  hide();
  cout << "Done drawing." << endl;
  return 0;
}
` },
  ],
  'Click and keys': [
    { name: 'main.cpp', content: `#include <simplecpp>

int main() {
  initCanvas("Click and keys", 500, 500);
  Circle dot(250, 250, 20);
  dot.setColor(COLOR("red"));
  dot.setFill();

  cout << "Click anywhere (or press a key)..." << endl;
  int click = getClick();
  cout << "Clicked at " << (click / 65536) << ", " << (click % 65536) << endl;
  XEvent e;
  if (checkEvent(e) && keyPressEvent(e))
    cout << "You pressed: " << charFromEvent(e) << endl;
  dot.moveTo(click / 65536, click % 65536);
  return 0;
}
` },
  ],
  'Multiple files': [
    { name: 'main.cpp', content: `#include <simplecpp>
#include "shapes.h"

int main() {
  initCanvas("Multi-file project", 500, 500);
  drawFlower(250, 250);
  cout << "flower() returned " << petals(8) << endl;
  return 0;
}
` },
    { name: 'shapes.h', content: `#ifndef SHAPES_H
#define SHAPES_H
void drawFlower(double x, double y);
int petals(int n);
#endif
` },
    { name: 'shapes.cpp', content: `#include <simplecpp>
#include "shapes.h"

int petals(int n) { return n * 2; }

void drawFlower(double x, double y) {
  for (int i = 0; i < 8; i++) {
    double angle = i * PI / 4;
    Circle c(x + 90 * cos(angle), y + 90 * sin(angle), 30);
    c.setColor(COLOR(i % 2 ? "pink" : "yellow"));
    c.setFill();
    c.imprint();   // keep each petal on the persistent background
  }
  Circle centre(x, y, 32);
  centre.setColor(COLOR("orange"));
  centre.setFill();
  centre.imprint();
}
` },
  ],
  'Fractals': [
    { name: 'main.cpp', content: `#include <simplecpp>
#include "fractals.h"

int main() {
  cout << "Fractals available:\\n"
          "1. Koch curve\\n"
          "2. Koch curve (alternating)\\n"
          "3. Sierpiński Triangle\\n"
          "4. Binary Tree Canopy\\n"
          "5. Binary Tree (CS style)\\n"
          "6. Hilbert Curve\\n"
          "Choose the fractal to draw: ";
  int choice; cin >> choice;

  const double width = 800, height = 800, margin = 10;
  turtleSim("Fractal", width + 2 * margin, height + 2 * margin);

  hide(true);

  if (choice == 1) {
    penUp(); forward(-width / 2);
    penDown(); fract::kochCurve(width, 6);
  } else if (choice == 2) {
    penUp(); forward(-width / 2);
    penDown(); fract::kochCurveAlt(width, 1, 6);
  } else if (choice == 3) {
    double side = min(width, height * cosine(30));
    penUp(); right(150); forward(side / (2 * cosine(30))); left(150);
    penDown(); fract::sTriangle(side, 6);
  } else if (choice == 4) {
    penUp(); left(90); forward(-height / 2);
    penDown(); fract::canopy(height / 4, 10);
  } else if (choice == 5) {
    penUp(); right(90); forward(-height / 2);
    penDown(); fract::binaryTree(height, width, 7);
  } else if (choice == 6) {
    int level = 3;
    double box = min(min(height, width), 20 * (pow(2, level + 1) - 1));
    double step = box / (pow(2, level + 1) - 1);
    penUp(); forward(-box / 2); right(90); forward(box / 2); left(90);
    penDown(); fract::hilbertCurve(step, 1, level);
  }
  cout << "Click to exit" << endl;
  getClick();
  return 0;
}
` },
    { name: 'fractals.h', content: `#ifndef FRACTALS_H
#define FRACTALS_H

namespace fract {
void kochCurve(double len, int level);
void kochCurveAlt(double len, int sign, int level);
void sTriangle(double side, int level);
void canopy(double step, int level, double angle = 45, double ratio = 0.5);
void binaryTree(double boxHeight, double boxWidth, int levels);
void hilbertCurve(double step, int sign, int level);
}

#endif
` },
    { name: 'fractals.cpp', content: `#include <simplecpp>
#include "fractals.h"

void fract::kochCurve(double len, int level) {
  if (level == 0) {
    forward(len);
    return;
  }
  kochCurve(len / 3, level - 1);
  left(60);
  kochCurve(len / 3, level - 1);
  right(120);
  kochCurve(len / 3, level - 1);
  left(60);
  kochCurve(len / 3, level - 1);
}

void fract::kochCurveAlt(double len, int sign, int level) {
  if (level == 0) {
    forward(len);
    return;
  }
  kochCurveAlt(len / 3, -sign, level - 1);
  left(sign * 60);
  kochCurveAlt(len / 3, sign, level - 1);
  right(sign * 120);
  kochCurveAlt(len / 3, sign, level - 1);
  left(sign * 60);
  kochCurveAlt(len / 3, -sign, level - 1);
}

void fract::sTriangle(double side, int level) {
  for (int i = 0; i < 3; i++) {
    forward(side); left(120);
  }
  if (level == 0) return;
  sTriangle(side / 2, level - 1);
  penUp(); forward(side / 2); penDown();
  sTriangle(side / 2, level - 1);
  penUp(); left(120); forward(side / 2); right(120); penDown();
  sTriangle(side / 2, level - 1);
  penUp(); right(120); forward(side / 2); left(120); penDown();
}

void fract::canopy(double step, int level, double angle, double ratio) {
  if (level == 0) return;
  forward(step);
  left(angle / 2);
  canopy(step * ratio, level - 1, angle, ratio);
  right(angle);
  canopy(step * ratio, level - 1, angle, ratio);
  left(angle / 2);
  forward(-step);
}

void fract::binaryTree(double boxHeight, double boxWidth, int levels) {
  if (levels == 0) return;

  double edgeHeight = boxHeight / levels;
  double angle = arctangent((boxWidth / 4) / edgeHeight);
  double edgeLen = edgeHeight / cosine(angle);

  double childBoxHeight = boxHeight - edgeHeight;
  double childBoxWidth = boxWidth / 2;

  for (int i = 0; i < 2; i++, angle = -angle) {
    left(angle); forward(edgeLen); left(-angle);
    binaryTree(childBoxHeight, childBoxWidth, levels - 1);
    left(angle); forward(-edgeLen); left(-angle);
  }
}

void fract::hilbertCurve(double step, int sign, int level) {
  int deg = sign * 90;
  double len = (pow(2, level + 1) - 1) * step;
  if (level == 0) {
    left(deg); forward(len);
    right(deg); forward(len);
    right(deg); forward(len);
    left(deg);
    return;
  }

  left(deg);
  hilbertCurve(step, -sign, level - 1); forward(step);
  right(deg);
  hilbertCurve(step, sign, level - 1); forward(step);
  hilbertCurve(step, sign, level - 1);
  right(deg); forward(step);
  hilbertCurve(step, -sign, level - 1);
  left(deg);
}
` },
  ],
};

export function defaultFiles() {
  return EXAMPLES['Welcome'].map(f => ({ ...f }));
}
