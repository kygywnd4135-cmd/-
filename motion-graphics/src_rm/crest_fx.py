"""Finale crest: pops in with overshoot, a sheen sweep and a coloured glow."""
import numpy as np, cv2, math
from PIL import Image
def load_crest(path, px=600):
    c=np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)/255
    c=cv2.resize(c,(px,px),interpolation=cv2.INTER_AREA)
    c[...,:3]*=c[...,3:4]          # premultiply
    return c
def _ob(x,c1=1.4):
    x=max(0.0,min(1.0,x)); c3=c1+1; return 1+c3*(x-1)**3+c1*(x-1)**2
def draw_crest(img, crest, tr, glow, size=190, cy=160, t0=1.0):
    FH,FW=img.shape[:2]
    ke=max(0.0,min(1.0,(tr-t0)/0.8)); ke=1-(1-ke)**3
    if ke<=0: return img
    sz=size*_ob((tr-t0)/0.55)
    if sz<2: return img
    h,w=crest.shape[:2]
    M=cv2.getRotationMatrix2D((w/2,h/2),0,sz/w); M[0,2]+=FW/2-w/2; M[1,2]+=cy-h/2
    cr=cv2.warpAffine(crest,M,(FW,FH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
    ca=cr[...,3]*ke; crgb=cr[...,:3]
    su=(tr-t0-0.6)/0.7
    if 0<su<1:
        yy,xx=np.mgrid[0:FH,0:FW].astype(np.float32)
        band=np.exp(-((xx-(FW/2-size+su*2*size))+(yy-cy)*0.6)**2/(2*18**2))
        crgb=crgb+band[...,None]*0.5*cr[...,3:4]
    rgb=img[...,:3]
    rgb+=cv2.GaussianBlur(ca,(0,0),14)[...,None]*np.asarray(glow,np.float32)*0.55
    rgb[...]=rgb*(1-ca[...,None])+crgb*ca[...,None]
    return img
