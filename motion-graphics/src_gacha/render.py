"""Gacha banner select motion — test (EP.02). UI plate stays fixed; everything behind it animates."""
import sys, os, math, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
HERE=os.path.dirname(os.path.abspath(__file__)); S=os.path.join(HERE,'..')+'/'; A=S+'gacha/assets/'
W,H,FPS=1920,1080,30
DUR=float(os.environ.get('DUR','4.6'))
def clamp(v,a=0.,b=1.): return max(a,min(b,v))
def eout(t,p=3): t=clamp(t); return 1-(1-t)**p
def ein(t,p=3): t=clamp(t); return t**p
def eio(t): t=clamp(t); return 4*t**3 if t<.5 else 1-(-2*t+2)**3/2
def back(t,s=1.7): t=clamp(t); c=s+1; return 1+c*(t-1)**3+s*(t-1)**2
def pm(path,size=None):
    im=Image.open(path).convert('RGBA')
    if size: im=im.resize(size,Image.LANCZOS)
    a=np.asarray(im).astype(np.float32)/255; a[...,:3]*=a[...,3:4]; return a
_yy,_xx=np.mgrid[0:H,0:W].astype(np.float32)

# ---------- assets ----------
BG=pm(A+'plate_bg.png',(W,H))[...,:3]
UI=pm(A+'plate_ui.png')
P1=pm(A+'bg_panel1.png'); P2=pm(A+'bg_panel2.png')
TITLE=pm(A+'title.png'); LT=pm(A+'line_top.png'); LB=pm(A+'line_bot.png'); EPN=pm(A+'epnum.png')
TAGS={'arin':(pm(A+'tag_arin.png'),(1651,492)),'nea':(pm(A+'tag_nea.png'),(1183,639)),'koyuki':(pm(A+'tag_koyuki.png'),(590,540))}
CREST=pm(A+'crest.webp',(442,442)); CREST_C=(960,411)
def glow_from_alpha(a,col,r):
    g=cv2.GaussianBlur(a,(0,0),r); g=np.clip(g*2.2,0,1); return g
def char_layer(img,box,glowcol=(0.85,0.92,1.0)):
    x,y,w,h=box; L=np.zeros((H,W,4),np.float32)
    im=cv2.resize(img,(w,h),interpolation=cv2.INTER_CUBIC)
    L[y:y+h,x:x+w]=im[:H-y,:W-x][:min(h,H-y),:min(w,W-x)]
    return L
# Arin / Koyuki: Figma exports (already carry their glow). Nea: high-res sprite aligned to the Figma placement.
CH={}
CH['arin']=char_layer(pm(A+'char_arin.png'),(1162,0,758,1080))
CH['koyuki']=char_layer(pm(A+'char_koyuki.png'),(358,0,994,1080))
_ns=np.load(S+'cut/sprite2x.npy').astype(np.float32)/255; _ns[...,:3]*=_ns[...,3:4]
sc=1406/1232*0.5; nw,nh=int(_ns.shape[1]*sc),int(_ns.shape[0]*sc)
_n=cv2.resize(_ns,(nw,nh),interpolation=cv2.INTER_AREA)
NEA=np.zeros((H,W,4),np.float32); ox,oy=496,71
NEA[oy:oy+min(nh,H-oy),ox:ox+min(nw,W-ox)]=_n[:H-oy,:W-ox]
g=glow_from_alpha(NEA[...,3],(1,1,1),7)*(1-NEA[...,3])
NEA[...,:3]+=g[...,None]*np.array([0.92,0.95,1.0]); NEA[...,3]=np.clip(NEA[...,3]+g,0,1)
CH['nea']=NEA
SILC=np.array([0.0745,0.106,0.169],np.float32)
def silhouette(L,k_rim=1.0):
    a=L[...,3]; rim=np.clip(a-cv2.erode(a,np.ones((5,5),np.uint8)),0,1)
    rgb=SILC[None,None]*a[...,None]+rim[...,None]*np.array([0.55,0.68,0.95])*0.9*k_rim
    return np.dstack([rgb,a])
SIL={k:silhouette(v) for k,v in CH.items()}
ORDER=['arin','koyuki','nea']           # Figma stacking (bottom -> top)

# ---------- helpers ----------
def over(dst,src,op=1.0):
    a=src[...,3:4]*op; dst[...]=src[...,:3]*op+dst*(1-a); return dst
def shift(L,dx,dy):
    M=np.float32([[1,0,dx],[0,1,dy]]); return cv2.warpAffine(L,M,(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
def xform(L,cx,cy,s,rot=0,dx=0,dy=0):
    M=cv2.getRotationMatrix2D((cx,cy),rot,s); M[0,2]+=dx; M[1,2]+=dy
    return cv2.warpAffine(L,M,(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
def place(img,x,y,canvas_size=(W,H)):
    L=np.zeros((H,W,img.shape[2]),np.float32); h,w=img.shape[:2]
    x0,y0=max(0,int(x)),max(0,int(y)); x1,y1=min(W,int(x)+w),min(H,int(y)+h)
    if x1>x0 and y1>y0: L[y0:y1,x0:x1]=img[y0-int(y):y1-int(y),x0-int(x):x1-int(x)]
    return L
def hblur(rgb,k):
    k=int(k)
    if k<2: return rgb
    return cv2.blur(rgb,(k,1))
def glitch(img,k,seed,band=(0,H)):
    if k<=0.02: return img
    rng=np.random.default_rng(seed); out=img.copy(); dx=int(3+30*k)
    out[...,0]=np.roll(img[...,0],dx,1); out[...,2]=np.roll(img[...,2],-dx,1)
    for _ in range(int(4+16*k)):
        y0=int(rng.integers(band[0],band[1]-8)); h=int(rng.integers(3,int(10+110*k)))
        out[y0:y0+h]=np.roll(out[y0:y0+h],int(rng.choice([-1,1])*rng.uniform(20,220)*k),1)
    for _ in range(int(6*k)):
        x0=int(rng.integers(0,W-80)); y0=int(rng.integers(band[0],band[1]-30)); w=int(rng.integers(40,int(80+360*k))); h=int(rng.integers(6,int(14+50*k)))
        c=[np.array([0.95,0.75,0.45]),np.array([0.35,0.45,1.0]),np.array([0.9,0.95,1.0])][int(rng.integers(3))]
        out[y0:y0+h,x0:x0+w]=out[y0:y0+h,x0:x0+w]*0.25+c*0.75
    out[::3]*=1-0.25*k
    return out
def static_noise(seed,k):
    n=np.random.default_rng(seed).random((H//3,W//3)).astype(np.float32)
    return cv2.resize(n,(W,H),interpolation=cv2.INTER_NEAREST)[...,None]*k

# big kinetic word
F_BIG=ImageFont.truetype(S+'fonts/Cinzel.ttf',230)
try: F_BIG.set_variation_by_name('Bold')
except Exception: pass
def word_mask(txt,font,sp=8):
    ws=[font.getbbox(c)[2]-font.getbbox(c)[0] for c in txt]; tot=sum(ws)+sp*(len(txt)-1)
    m=Image.new('L',(int(tot)+40,320),0); d=ImageDraw.Draw(m); x=20
    for c,w in zip(txt,ws):
        b=font.getbbox(c); d.text((x-b[0],160-(b[1]+b[3])/2),c,font=font,fill=255); x+=w+sp
    return np.asarray(m).astype(np.float32)/255
WORD1=word_mask('EPISODE',F_BIG,10); WORD2=word_mask('02',F_BIG,24)

def rope_ring(cv_img,c,r,t,k,col=(0.95,0.97,1.0)):
    """braided ring: two out-of-phase wavy circles"""
    if k<=0: return
    n=180; a0=-math.pi/2; span=2*math.pi*clamp(k)
    for ph,w in ((0,5),(math.pi,5)):
        ang=a0+np.linspace(0,span,n)+t*2.2
        rr=r+9*np.sin(ang*14+ph+t*6)
        pts=np.stack([c[0]+np.cos(ang)*rr,c[1]+np.sin(ang)*rr],1)
        cv2.polylines(cv_img,[(pts*16).astype(np.int32)],False,col,w,cv2.LINE_AA,4)

# tab highlight (selected EP.02 tab in the UI plate)
TAB=(80,932,303,118)

# ---------- timeline ----------
T_NOISE=0.62; T_CREST=0.95; T_LOCK=1.45; T_CREST_OUT=1.75; T_SIL=1.95; T_REVEAL=2.75; T_SETTLE=3.15
def render(f):
    t=f/FPS
    img=np.zeros((H,W,3),np.float32)+np.array([0.023,0.066,0.183],np.float32)
    # ----- background (parallax drift + panel sweeps) -----
    bk=eout((t-T_NOISE)/0.35)
    if bk>0:
        drift=-40*(1-eout((t-T_NOISE)/1.6))
        b=shift(np.dstack([BG,np.ones((H,W),np.float32)]),drift,0)[...,:3]
        if t<T_NOISE+0.25: b=hblur(b,90*(1-(t-T_NOISE)/0.25))
        img=b*bk+img*(1-bk)
    # diagonal panel sweeps (gold-tinted like the reference's orange panel, then blue)
    for (P,t0,dir_,tint) in ((P1,T_CREST-0.05,1,(1.0,0.78,0.45)),(P2,T_CREST_OUT-0.05,-1,(0.55,0.62,1.0)),(P1,T_SIL+0.35,1,(0.9,0.85,1.0))):
        u=(t-t0)/0.55
        if 0<u<1:
            L=place(P,0 if P is P1 else 618,0); L=shift(L,dir_*(-1400+2800*eio(u)),0)
            L[...,:3]*=np.array(tint,np.float32); over(img,L,0.55*math.sin(math.pi*u))
    # ----- big kinetic word + sliding blocks (ref 0.6–1.9 s) -----
    wk=clamp((t-T_NOISE)/0.2)*(1-clamp((t-T_REVEAL)/0.25))
    if wk>0:
        u=t-T_NOISE
        x1=-300+520*eout(u/0.5)+40*u; x2=980-200*eout(u/0.6)-30*u
        for m,x,y in ((WORD1,x1,250),(WORD2,x2,470)):
            L=np.zeros((H,W,4),np.float32); M=place(m[...,None],x,y)[...,0]
            L[...,:3]=M[...,None]*np.array([0.92,0.94,1.0]); L[...,3]=M
            over(img,L,0.22*wk if t<T_SIL else 0.32*wk)
        # blocks cut across the word (peach + violet), like the reference
        for i,(by,bh,col,sp,d0) in enumerate(((300,70,(0.98,0.74,0.58),1,0.0),(470,64,(0.55,0.42,0.95),-1,0.08),(560,46,(0.98,0.74,0.58),1,0.16))):
            uu=(t-(T_SIL-0.25)-d0)/0.9
            if 0<uu<1:
                w_=520+300*math.sin(math.pi*uu); x=(-600+2400*eio(uu)) if sp>0 else (1900-2400*eio(uu))
                cv2.rectangle(img,(int(x),by),(int(x+w_),by+bh),col,-1)
    # ----- crest assembly: 3 strips slide in, glitch-jitter, lock (ref ring+diamond) -----
    ck=(t>=T_CREST-0.05)*(1-clamp((t-T_CREST_OUT)/0.25))
    if ck>0:
        ring=np.zeros((H,W,3),np.float32)
        rope_ring(ring,CREST_C,250*(1+0.25*eout((t-T_LOCK)/0.4)),t,eout((t-T_NOISE-0.05)/0.45))
        img+=ring*0.9*ck+cv2.GaussianBlur(ring,(0,0),8)*0.8*ck
        cr=place(CREST,CREST_C[0]-221,CREST_C[1]-221)
        strips=((0,128),(128,274),(274,442))     # same cuts as 휘장 신호 1/2/3
        out=np.zeros_like(cr)
        for i,(a,b_) in enumerate(strips):
            u=(t-T_CREST-i*0.07)/0.4
            if u<=0: continue
            sx=(1 if i%2==0 else -1)*900*(1-eout(u,4))
            jit=0 if t>T_LOCK else np.random.default_rng(f*7+i).uniform(-18,18)*(1-clamp((t-T_LOCK+0.15)/0.15))
            s=np.zeros_like(cr); y0=CREST_C[1]-221+a; y1=CREST_C[1]-221+b_
            s[y0:y1]=cr[y0:y1]; out=out+shift(s,sx+jit,0)*(1-out[...,3:4])
        sc_=1+0.12*back((t-T_LOCK)/0.35)-0.12*eout((t-T_LOCK)/0.35)+0.5*ein((t-T_CREST_OUT)/0.25)
        out=xform(out,CREST_C[0],CREST_C[1],sc_)
        img+=cv2.GaussianBlur(out[...,:3],(0,0),18)*0.7*ck*(1+2.5*math.exp(-((t-T_LOCK)/0.07)**2))
        over(img,out,ck)
        sw=(t-T_LOCK-0.05)/0.45
        if 0<sw<1:
            band=np.exp(-((_xx-(CREST_C[0]-260+sw*520))+(_yy-CREST_C[1])*0.5)**2/(2*24**2))*out[...,3]
            img+=band[...,None]*np.array([1.0,0.95,0.8])*0.9
    # ----- characters: silhouette -> glitch -> art -----
    for i,k in enumerate(ORDER):
        ts=T_SIL+[0.0,0.12,0.24][i]; tr=T_REVEAL+[0.0,0.1,0.2][i]
        if t<ts: continue
        u=(t-ts)/0.35; dx=[70,-70,0][i]*(1-eout(u)); dy=[0,0,50][i]*(1-eout(u))
        if t<tr:
            L=shift(SIL[k],dx,dy); over(img,L,eout(u*1.5))
        else:
            v=(t-tr)/0.3
            if v<1:   # flicker between silhouette and art
                on=(int((t-tr)*FPS)%2==0)
                over(img,CH[k] if on or v>0.6 else SIL[k])
            else:
                drift=6*math.sin(t*1.1+i)
                over(img,shift(CH[k],0,drift))
    # ----- title / lines / tags -----
    tk=eout((t-T_SETTLE)/0.45)
    if tk>0:
        wipe=np.clip((_xx-(25-80+(628+160)*eout((t-T_SETTLE)/0.55)))/-80,0,1)
        L=place(TITLE,25,65); L*=wipe[...,None]; over(img,L)
        img+=cv2.GaussianBlur(L[...,:3],(0,0),10)*0.5*math.exp(-((t-T_SETTLE-0.3)/0.25)**2)
        lk=eout((t-T_SETTLE-0.15)/0.4)
        for Lm,y in ((LT,454),(LB,500)):
            w_=int(543*lk)
            if w_>2:
                seg=Lm[:,271-w_//2:271+w_//2+1]; over(img,place(seg,55+271-w_//2,y))
        over(img,place(EPN,266,470),eout((t-T_SETTLE-0.3)/0.3))
    for i,k in enumerate(ORDER):
        tt=(t-(T_SETTLE+0.25+i*0.1))/0.3
        if tt>0:
            im,(x,y)=TAGS[k]; s=back(tt); L=place(im,x,y)
            L=xform(L,x+im.shape[1]/2,y+im.shape[0]/2,0.6+0.4*s); over(img,L,eout(tt*2))
    # ----- opening static + glitch passes -----
    if t<T_NOISE:
        img=img*0.6+static_noise(f,0.28)*np.array([0.6,0.7,1.0])
        gk=0.9
    else:
        gk=0.0
    for tb,w,kk in ((T_NOISE,0.06,1.0),(T_CREST-0.02,0.04,0.5),(T_LOCK,0.04,0.6),(T_SIL,0.05,0.7),(T_REVEAL,0.06,1.1),(T_REVEAL+0.1,0.04,0.8),(T_REVEAL+0.2,0.04,0.8)):
        gk=max(gk,kk*math.exp(-((t-tb)/w)**2))
    img=glitch(img,gk,f*31+3,band=(90,900))
    img+=(0.35*math.exp(-((t-T_NOISE)/0.05)**2)+0.45*math.exp(-((t-T_REVEAL-0.2)/0.06)**2))*np.array([0.85,0.9,1.0])
    # ----- fixed UI on top + selected-tab pulse -----
    over(img,UI)
    x,y,w,h=TAB; p=0.5+0.5*math.sin(t*6) if t<T_SETTLE else 0.3
    tabg=np.zeros((H,W,3),np.float32); cv2.rectangle(tabg,(x-2,y-2),(x+w+2,y+h+2),(0.55,0.65,1.0),3)
    img+=cv2.GaussianBlur(tabg,(0,0),6)*p*1.6+tabg*0.6*p
    return (np.clip(img,0,1)*255+0.5).astype(np.uint8)

if __name__=='__main__':
    only=sys.argv[1:]
    if only:
        for f in map(int,only): Image.fromarray(render(f)).save(S+f'output/g_pv_{f:03d}.png')
        sys.exit()
    out=S+'output/gacha_ep02_test.mp4'; N=int(DUR*FPS)
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','16','-preset','medium','-movflags','+faststart',out],stdin=subprocess.PIPE)
    import multiprocessing as mp
    with mp.get_context('fork').Pool(3) as pool:
        for fr in pool.imap(render,range(N),chunksize=2): p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait(); print('done',out)
