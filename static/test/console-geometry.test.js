import test from 'node:test';
import assert from 'node:assert/strict';
import { editPolygon, headingPoint, scanVector } from '../src/console/geometry-editor.js';

const rectangle=[[-100,0],[100,0],[100,200],[-100,200]];
test('dragging translates without distorting or mutating polygon and respects range',()=>{
  assert.deepEqual(editPolygon(rectangle,'move',null,10,20),[[-90,20],[110,20],[110,220],[-90,220]]);
  assert.deepEqual(rectangle,[[-100,0],[100,0],[100,200],[-100,200]]);
  assert.deepEqual(editPolygon(rectangle,'move',null,9999,9999),[[1800,1800],[2000,1800],[2000,2000],[1800,2000]]);
});
test('resize anchors top left and vertex drag changes only selected vertex',()=>{
  assert.deepEqual(editPolygon(rectangle,'resize',null,100,-100),[[-100,0],[200,0],[200,100],[-100,100]]);
  assert.deepEqual(editPolygon(rectangle,'vertex',1,10,20),[[-100,0],[110,20],[100,200],[-100,200]]);
  assert.deepEqual(editPolygon(rectangle,'vertex',1,Infinity,0),rectangle);
  assert.deepEqual(editPolygon([[0,null],[0,0],[1,1]],'move',null,10,10),[[0,null],[0,0],[1,1]]);
});
test('plan view +Y points down and 3D installation uses card yaw/pitch/roll basis',()=>{
  assert.deepEqual(headingPoint(0,0,0,100),[0,100]);
  assert.ok(Math.abs(headingPoint(0,0,90,100)[0]-100)<1e-9);
  assert.deepEqual(scanVector(0,0,0,0,0,100),[0,100,0]);
  assert.ok(scanVector(0,30,0,0,0,100)[2]<0);
  const unrolled=scanVector(0,0,0,30,0,100),rolled=scanVector(0,0,90,30,0,100);
  assert.ok(unrolled[0]>0 && Math.abs(unrolled[2])<1e-9);
  assert.ok(Math.abs(rolled[0])<1e-9 && rolled[2]<0);
});
