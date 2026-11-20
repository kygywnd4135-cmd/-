import numpy as np, cv2, math
import os
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
FW,FH,FPS=1080,1920,30
SPR=np.load(S+'an/sprite2x.npy')            # H,W,4 uint8 straight alpha
SH,SW=SPR.shape[:2]
_w=np.load(S+'an/weights2x.npz'); WL,WR,WCH=[_w[k] for k in ('L','R','ch')]
GX,GY=np.meshgrid(np.arange(SW,dtype=np.float32),np.arange(SH,dtype=np.float32))
YN=GY/SH
_pm=SPR.astype(np.float32)/255; _pm[...,:3]*=_pm[...,3:4]; SPR_PM=_pm   # premultiplied float

def clamp(v,a=0.,b=1.): return max(a,min(b,v))
def ease(t): t=clamp(t); return t*t*(3-2*t)
def eio(t,p=3):
    t=clamp(t); return 4*t*t*t if t<.5 else 1-(-2*t+2)**3/2
def eout(t,p=3): t=clamp(t); return 1-(1-t)**p

def displacement(t, amp=1.0):
    w=2*math.pi*0.40
    k=2*math.pi*YN*2.0
    sL=0.72*np.sin(w*t-k)+0.28*np.sin(1.7*w*t-1.3*k+0.8)
    sR=0.72*np.sin(w*t-k-1.1)+0.28*np.sin(1.55*w*t-1.4*k+2.0)
    A=26*amp
    dx=A*(WL*sL+WR*sR)
    dy=A*0.30*(WL*np.cos(w*t-k)+WR*np.cos(w*t-k-1.1))
    wc=2*math.pi*0.55
    dx+=10*amp*WCH*np.sin(wc*t-k*1.5)
    br=math.sin(2*math.pi*0.30*t)
    dy+=-3.0*amp*br*np.clip((1800-GY)/1500,0,1)
    return dx,dy

def char_frame(t, amp=1.0):
    dx,dy=displacement(t,amp)
    return cv2.remap(SPR_PM,GX-dx,GY-dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)

def place(layer_pm, cx, cy, scale, rot=0.0, sx=None, sy=None, out=(FW,FH)):
    """Map layer so that source point (sx,sy) [default centre] lands at frame (cx,cy)."""
    h,w=layer_pm.shape[:2]; sx=w/2 if sx is None else sx; sy=h/2 if sy is None else sy
    M=cv2.getRotationMatrix2D((sx,sy),rot,scale); M[0,2]+=cx-sx; M[1,2]+=cy-sy
    return cv2.warpAffine(layer_pm,M,out,flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)

def over(dst, src_pm, opacity=1.0):
    a=src_pm[...,3:4]*opacity
    dst[...,:3]=src_pm[...,:3]*opacity+dst[...,:3]*(1-a)
    return dst

def add(dst, rgb, k=1.0): dst[...,:3]+=rgb[...,:3]*k; return dst

def glow(pm, sigma, k):
    g=cv2.GaussianBlur(pm[...,:3],(0,0),sigma); return g*k

# ---------- background & particles ----------
_yy,_xx=np.mgrid[0:FH,0:FW].astype(np.float32)
def bg_navy(t, lift=0.0):
    r=np.hypot((_xx-FW/2)/FW,(_yy-FH*0.42)/FH)
    top=np.array([0.035,0.05,0.12]); mid=np.array([0.07,0.11,0.26])
    g=np.clip(1-r*1.6,0,1)[...,None]
    c=top+(mid-top)*g*(0.8+0.2*lift)
    vign=np.clip(1-(r**2)*1.1,0.25,1)[...,None]
    img=np.zeros((FH,FW,4),np.float32); img[...,:3]=c*vign; img[...,3]=1
    return img

rng=np.random.default_rng(7)
NP=170
P=dict(x=rng.uniform(0,FW,NP),y=rng.uniform(0,FH,NP),vy=rng.uniform(-38,-12,NP),vx=rng.uniform(-6,10,NP),
       r=rng.uniform(1.0,3.2,NP),ph=rng.uniform(0,6.28,NP),gold=rng.random(NP)<0.45,z=rng.uniform(0.6,1.6,NP))
def particles(t, k=1.0, drift=(0,0)):
    lay=np.zeros((FH,FW,3),np.float32)
    for i in range(NP):
        x=(P['x'][i]+P['vx'][i]*t*P['z'][i]+drift[0]*P['z'][i])%FW
        y=(P['y'][i]+P['vy'][i]*t*P['z'][i]+drift[1]*P['z'][i])%FH
        tw=0.55+0.45*math.sin(t*2.3+P['ph'][i])
        col=(0.45,0.95,0.92) if P['gold'][i] else (0.62,0.75,1.0)
        cv2.circle(lay,(int(x),int(y)),max(1,int(P['r'][i]*P['z'][i])),tuple(c*tw*k for c in col),-1,cv2.LINE_AA)
    return lay+cv2.GaussianBlur(lay,(0,0),6)*2.2

def sparkle(lay, x, y, size, k, col=(1,1,1), rot=0):
    """four-point star glint"""
    s=int(size)
    for ang,l in ((rot,1.0),(rot+90,1.0),(rot+45,0.45),(rot+135,0.45)):
        a=math.radians(ang); dx,dy=math.cos(a)*s*l,math.sin(a)*s*l
        cv2.line(lay,(int(x-dx),int(y-dy)),(int(x+dx),int(y+dy)),tuple(c*k for c in col),2,cv2.LINE_AA)
    cv2.circle(lay,(int(x),int(y)),max(2,s//8),tuple(c*k*1.5 for c in col),-1,cv2.LINE_AA)
    return lay

def to8(img): return (np.clip(img[...,:3],0,1)*255+0.5).astype(np.uint8)
