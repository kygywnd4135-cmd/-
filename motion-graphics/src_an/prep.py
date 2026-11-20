import numpy as np, cv2
from PIL import Image
import os
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
K=2; W0,H0=1232,1632; W,H=W0*K,H0*K
x4=np.asarray(Image.open(S+'an/x4.png').convert('RGB')).astype(np.float32)/255
rgb=cv2.resize(x4,(W,H),interpolation=cv2.INTER_AREA)
a0=np.asarray(Image.open(S+'an/clean.png'))[...,3].astype(np.float32)/255
a=cv2.resize(a0,(W,H),interpolation=cv2.INTER_CUBIC).clip(0,1)
a=cv2.erode(a,np.ones((3,3),np.uint8))
B=253/255
m=(a>0.02)&(a<0.98)
rgb[m]=((rgb[m]-(1-a[m,None])*B)/a[m,None]).clip(0,1)
rgb[a<=0.02]=0
out=(np.dstack([rgb,a])*255).round().astype(np.uint8)
np.save(S+'an/sprite2x.npy',out); Image.fromarray(out).save(S+'an/sprite2x.png')

yy,xx=np.mgrid[0:H0,0:W0].astype(np.float32)
def ss(e0,e1,v):
    t=np.clip((v-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def poly(pts):
    m=np.zeros((H0,W0),np.float32); cv2.fillPoly(m,[np.array(pts,np.int32)],1); return m
# LEFT group: hair curls + hanging sleeve + tassel (one wind field so they never tear apart)
hairL=poly([(20,470),(330,470),(330,1230),(20,1230)])*ss(330,90,xx)*ss(470,620,yy)
sleeveL=poly([(140,700),(470,700),(470,1420),(140,1420)])*ss(720,1400,yy)*0.9
L=np.maximum(hairL,sleeveL)
# RIGHT group
hairR=poly([(880,600),(1232,600),(1232,1300),(880,1300)])*ss(870,1140,xx)*ss(600,760,yy)
sleeveR=poly([(700,860),(1130,860),(1130,1640),(640,1640)])*ss(880,1620,yy)*0.95
R=np.maximum(hairR,sleeveR)
# hat chains (small)
ch=np.maximum(poly([(300,120),(380,120),(380,470),(300,470)])*ss(150,460,yy),
              poly([(1050,500),(1130,500),(1130,650),(1050,650)])*ss(500,640,yy))*0.6
# keep rigid: face/arm/hat/legs
rig=np.ones((H0,W0),np.float32)
for pts in ([(420,40),(1120,40),(1120,560),(420,560)],      # hat + head + raised arm
            [(460,880),(800,880),(800,1600),(460,1600)]):   # legs & shoes
    rig*=1-poly(pts)
rig=cv2.GaussianBlur(rig,(0,0),18)
def soft(m,s): return cv2.GaussianBlur(m,(0,0),s)
L=soft(L,16)*rig; R=soft(R,16)*rig; ch=soft(ch,8)
maps={k:cv2.resize(v,(W,H),interpolation=cv2.INTER_LINEAR) for k,v in (('L',L),('R',R),('ch',ch))}
np.savez(S+'an/weights2x.npz',**maps)
viz=np.dstack([R,L,ch]); base=a0[...,None]*0.35
Image.fromarray(((viz*0.85+base).clip(0,1)*255).astype(np.uint8)).resize((616,816)).save(S+'an/weights_viz.png')
print('ok')
