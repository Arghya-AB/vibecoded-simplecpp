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
};

export function defaultFiles() {
  return EXAMPLES['Welcome'].map(f => ({ ...f }));
}
