import numpy as np, cv2, os
from PIL import Image
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
K=2; W0,H0=1232,1632; W,H=W0*K,H0*K
x4=np.asarray(Image.open(S+'rm/x4.png').convert('RGB')).astype(np.float32)/255
rgb=cv2.resize(x4,(W,H),interpolation=cv2.INTER_AREA)
a0=np.asarray(Image.open(S+'rm/clean.png'))[...,3].astype(np.float32)/255
a=cv2.resize(a0,(W,H),interpolation=cv2.INTER_CUBIC).clip(0,1)
a=cv2.erode(a,np.ones((3,3),np.uint8))
B=1.0; m=(a>0.02)&(a<0.98)
rgb[m]=((rgb[m]-(1-a[m,None])*B)/a[m,None]).clip(0,1); rgb[a<=0.02]=0
out=(np.dstack([rgb,a])*255).round().astype(np.uint8)
np.save(S+'rm/sprite2x.npy',out)
yy,xx=np.mgrid[0:H0,0:W0].astype(np.float32)
def ss(e0,e1,v):
    t=np.clip((v-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def poly(pts):
    m=np.zeros((H0,W0),np.float32); cv2.fillPoly(m,[np.array(pts,np.int32)],1); return m
def segdist(p0,p1):
    p0=np.array(p0,float); p1=np.array(p1,float); v=p1-p0; L=np.linalg.norm(v)
    t=np.clip(((xx-p0[0])*v[0]+(yy-p0[1])*v[1])/L**2,0,1)
    return np.hypot(xx-(p0[0]+t*v[0]),yy-(p0[1]+t*v[1]))
L=poly([(0,200),(440,200),(440,840),(0,840)])*ss(440,160,xx)
R=poly([(690,0),(1232,0),(1232,1120),(690,1120)])*ss(700,960,xx)*ss(60,380,yy)
tie=poly([(270,350),(560,350),(560,600),(270,600)])*np.clip(np.hypot(xx-540,yy-420)/260,0,1)
rig=np.ones((H0,W0),np.float32)
rig*=ss(30,90,segdist((1160,372),(560,770)))                          # guitar neck + headstock
rig*=1-poly([(170,800),(330,760),(620,690),(660,830),(410,1090),(320,1070)])  # guitar body
rig*=1-poly([(860,440),(990,440),(990,580),(860,580)])               # fretting hand
rig*=1-poly([(300,0),(580,0),(580,340),(300,340)])                   # raised arm
rig*=1-poly([(450,120),(800,120),(800,900),(450,900)])               # head & torso
rig*=1-poly([(430,880),(980,880),(980,1632),(430,1632)])             # legs
rig=cv2.GaussianBlur(rig,(0,0),12)
def soft(m,s): return cv2.GaussianBlur(m,(0,0),s)
L=soft(L,18)*rig; R=soft(R,18)*rig; tie=soft(tie,10)*np.clip(rig+poly([(270,350),(560,350),(560,600),(270,600)])*0.8,0,1)
maps={k:cv2.resize(v,(W,H),interpolation=cv2.INTER_LINEAR) for k,v in (('L',L),('R',R),('tie',tie))}
np.savez(S+'rm/weights2x.npz',**maps)
viz=np.dstack([R,L,tie]); base=a0[...,None]*0.35
Image.fromarray(((viz*0.85+base).clip(0,1)*255).astype(np.uint8)).resize((616,816)).save(S+'rm/weights_viz.png')
print('ok')
