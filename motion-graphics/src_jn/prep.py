import numpy as np, cv2, os
from PIL import Image
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
K=2; W0,H0=1232,1632; W,H=W0*K,H0*K
x4=np.asarray(Image.open(S+'jn/x4.png').convert('RGB')).astype(np.float32)/255
rgb=cv2.resize(x4,(W,H),interpolation=cv2.INTER_AREA)
a0=np.asarray(Image.open(S+'jn/clean.png'))[...,3].astype(np.float32)/255
a=cv2.resize(a0,(W,H),interpolation=cv2.INTER_CUBIC).clip(0,1)
a=cv2.erode(a,np.ones((3,3),np.uint8))
B=254/255; m=(a>0.02)&(a<0.98)
rgb[m]=((rgb[m]-(1-a[m,None])*B)/a[m,None]).clip(0,1); rgb[a<=0.02]=0
out=(np.dstack([rgb,a])*255).round().astype(np.uint8)
np.save(S+'jn/sprite2x.npy',out); Image.fromarray(out).save(S+'jn/sprite2x.png')
yy,xx=np.mgrid[0:H0,0:W0].astype(np.float32)
def ss(e0,e1,v):
    t=np.clip((v-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def poly(pts):
    m=np.zeros((H0,W0),np.float32); cv2.fillPoly(m,[np.array(pts,np.int32)],1); return m
# left cape: billows out to the left
L=poly([(0,330),(480,330),(480,1260),(0,1260)])*ss(470,60,xx)*ss(380,700,yy)
# right cape tail
R=poly([(780,560),(1232,560),(1232,1600),(780,1600)])*ss(800,1130,xx)*ss(640,1250,yy)
# feathers
fe=poly([(440,0),(720,0),(720,95),(440,95)])*ss(110,0,yy)
cv2.circle(fe,(610,120),45,0,-1)
# rigid: cane + hand, legs/body
rig=np.ones((H0,W0),np.float32)
p0=np.array([1013.,987.]); p1=np.array([880.,1530.]); v=p1-p0; Ln=np.linalg.norm(v)
t=np.clip(((xx-p0[0])*v[0]+(yy-p0[1])*v[1])/Ln**2,0,1)
dist=np.hypot(xx-(p0[0]+t*v[0]),yy-(p0[1]+t*v[1]))
rig*=ss(16,70,dist)
rig*=1-poly([(960,620),(1120,620),(1120,1010),(960,1010)])
rig*=1-poly([(470,300),(800,300),(820,1632),(380,1632)])
rig=cv2.GaussianBlur(rig,(0,0),12)
def soft(m,s): return cv2.GaussianBlur(m,(0,0),s)
L=soft(L,18)*rig; R=soft(R,18)*rig; fe=soft(fe,8)
maps={k:cv2.resize(v,(W,H),interpolation=cv2.INTER_LINEAR) for k,v in (('L',L),('R',R),('fe',fe))}
np.savez(S+'jn/weights2x.npz',**maps)
viz=np.dstack([R,L,fe]); base=a0[...,None]*0.35
Image.fromarray(((viz*0.85+base).clip(0,1)*255).astype(np.uint8)).resize((616,816)).save(S+'jn/weights_viz.png')
print('ok')
