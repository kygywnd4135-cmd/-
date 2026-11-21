import sys, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import *
from lib import _yy,_xx
import opening as OP
from opening import Cv,over as OV,ribbon,curl_spine,RIB_TONES,MIST,mist_band,dots,bamboo_layer,background,TEAL,TEAL_L,RED,RED_L,mix
from PIL import Image, ImageDraw, ImageFont
import subprocess, multiprocessing as mp
K=2; DUR=12.0; N=int(DUR*FPS)
T1,T2,T3,T4,T5=3.3,4.0,5.5,7.0,8.5
F_EN=ImageFont.truetype(S+'fonts/Cinzel.ttf',140); 
try: F_EN.set_variation_by_name('Bold')
except Exception: pass
F_KR=ImageFont.truetype(S+'fonts/suite/SUITE-Medium.ttf',44); F_EP=ImageFont.truetype(S+'fonts/suite/SUITE-SemiBold.ttf',30)
def text_plain(txt,f):
    m=Image.new('L',(FW,400),0); ImageDraw.Draw(m).text((FW/2,200),txt,font=f,fill=255,anchor='mm')
    return np.asarray(m).astype(np.float32)/255
def text_spaced(txt,f,sp):
    widths=[f.getbbox(c)[2]-f.getbbox(c)[0] for c in txt]; total=sum(widths)+sp*(len(txt)-1)
    m=Image.new('L',(FW,400),0); d=ImageDraw.Draw(m); x=(FW-total)/2
    for c,w in zip(txt,widths):
        b=f.getbbox(c); d.text((x-b[0],200-(b[1]+b[3])/2),c,font=f,fill=255); x+=w+sp
    return np.asarray(m).astype(np.float32)/255
def band_at(m,cy):
    b=np.zeros((FH,FW),np.float32); y0=cy-200; y1=min(FH,y0+400); b[y0:y1]=m[:y1-y0]; return b
def grad_fill(m,c1,c2):
    nz=np.where(m.max(1)>0)[0]
    if len(nz)==0: return np.zeros(m.shape+(3,),np.float32)
    y0,y1=nz[0],nz[-1]+1; g=np.clip((np.arange(m.shape[0])-y0)/max(1,y1-y0),0,1)[:,None,None]
    return (np.array(c1,np.float32)*(1-g)+np.array(c2,np.float32)*g)*m[...,None]
def affine(cx,cy,scale,rot,sx,sy):
    M=cv2.getRotationMatrix2D((sx,sy),rot,scale); M[0,2]+=cx-sx; M[1,2]+=cy-sy; return M
def place_M(layer,M): return cv2.warpAffine(layer,M,(FW,FH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
def shot_char(t):
    if t<T3:   # boots -> robe hem -> sheath
        u=(t-T2)/(T3-T2); e=eio(u)
        fx,fy=700+(560-700)*e,1500+(1020-1500)*e; sc=1.20-0.05*e+0.05*(1-eout(u*4)); rot=-5+4*e; cy=FH*0.5
    elif t<T4: # blade from hand up to hilt & tassel
        u=(t-T3)/(T4-T3); e=eio(u)
        fx,fy=700+230*e,620-440*e; sc=1.30-0.06*e+0.05*(1-eout(u*4)); rot=10-5*e; cy=FH*0.5
    elif t<T5: # face under the hat
        u=(t-T4)/(T5-T4); e=eio(u)
        fx,fy=700,250+30*e; sc=1.55-0.20*e+0.05*(1-eout(u*4)); rot=-2+2*e; cy=FH*0.47
    else:
        u=(t-T5)/(DUR-T5-0.6); e=eout(u,3)
        fx,fy=700+(705-700)*e,330+(816-330)*e; sc=1.05+(0.62-1.05)*e; rot=0; cy=FH*0.5+(1215-FH*0.5)*e
    return affine(FW/2,cy,sc,rot,fx*K,fy*K)
def frame_layer(tr):
    cv=Cv(); gl=Cv(); p=eout(tr/1.1,3)
    for inset,col,th in ((38,TEAL_L,3),(52,RED_L,2)):
        x0,y0,x1,y1=inset,inset,FW-inset,FH-inset
        for (ax,ay,bx,by) in ((x0,y0,x1,y0),(x1,y0,x1,y1),(x1,y1,x0,y1),(x0,y1,x0,y0)):
            mx,my=(ax+bx)/2,(ay+by)/2
            for (sx_,sy_) in ((ax,ay),(bx,by)):
                q=[(sx_,sy_),(sx_+(mx-sx_)*p,sy_+(my-sy_)*p)]; cv.lines(q,col,th); gl.lines(q,col,th*3)
    k=eout((tr-0.5)/0.6)
    if k>0:
        for (x,y,sx_,sy_) in ((38,38,1,1),(FW-38,38,-1,1),(38,FH-38,1,-1),(FW-38,FH-38,-1,-1)):
            # little curl ornament in each corner
            sp=np.array([(x+sx_*20,y+sy_*20),(x+sx_*60,y+sy_*24),(x+sx_*100,y+sy_*40)])
            ribbon(cv,curl_spine(sp,60*k+1,1.2,sx_*sy_),16*k+1,RIB_TONES[1],outline=2,side=sx_*sy_)
    r,a=cv.f(); g,_=gl.f(); return r,a,g
def leaf_emblem(cv,C,s,k,t):
    """bamboo emblem: three stalk segments + leaves inside a ring"""
    x,y=C
    cv.circle(C,s*1.05*k+1,TEAL_L,2); cv.circle(C,s*1.18*k+1,RED_L,1)
    for i,(dx,h,ph) in enumerate(((-0.30,1.30,0.0),(0.0,1.6,0.3),(0.30,1.10,0.6))):
        w=s*0.16; q=clamp(k*1.4-ph)
        if q<=0: continue
        top=y+s*0.75-s*h*q; X=x+dx*s
        cv.poly([(X-w/2,y+s*0.75),(X-w/2,top),(X+w/2,top),(X+w/2,y+s*0.75)],(0.10,0.55,0.50))
        yy=y+s*0.75
        while yy>top+w:
            yy-=w*2.6; cv.poly([(X-w*0.6,yy-2),(X+w*0.6,yy-2),(X+w*0.6,yy+2),(X-w*0.6,yy+2)],TEAL_L)
    q=clamp((k-0.5)/0.5)
    if q>0:
        for a_,L in ((-0.6,0.8),(-0.2,0.95),(3.6,0.75),(3.3,0.9)):
            u=np.linspace(0,1,12); Lp=s*L*q; W=Lp*0.18
            sp=np.stack([u*Lp,np.zeros_like(u)],1); ww=W*np.sin(np.pi*u)**0.8
            poly=np.vstack([sp+np.stack([np.zeros_like(u),ww],1),(sp-np.stack([np.zeros_like(u),ww],1))[::-1]])
            c=math.cos(a_+0.1*math.sin(t*2)); s_=math.sin(a_+0.1*math.sin(t*2))
            cv.poly(poly@np.array([[c,-s_],[s_,c]]).T+[x,y-s*0.35],RED if a_>3 else (0.30,0.85,0.75))
FIN_MIST=[3,7,10,12,15,16]
def render(f):
    t=f/FPS
    if t<T2: return to8(OP.opening(t,T1,T2))
    fin=t>=T5
    img=background(t,moon_k=1.0 if fin else 0.7)
    if not fin: img=img*0.75
    ch=char_frame(t); M=shot_char(t)
    if fin:
        tr=t-T5; k=eout(tr/0.6)
        for L in (0,1):
            r,a=bamboo_layer(L,t,0.95+0.03*L,FW/2,FH/2)
            dy=int((1-k)*FH*0.5*(1+L*0.4))
            if dy: r=np.roll(r,dy,0); a=np.roll(a,dy,0); r[:dy]=0; a[:dy]=0
            img=r*0.8+img*(1-a[...,None]*0.8)
    L=place_M(ch,M)
    img+=cv2.GaussianBlur(L[...,3],(0,0),26)[...,None]*np.array(RED,np.float32)*0.10
    over(img,L)
    if fin:
        tr=t-T5
        fc=Cv(); dots(fc,t); fr_,fa_=fc.f(); OV(img,fr_,fa_*0.9)
        fr,fa,fg=frame_layer(tr-0.5); img+=cv2.GaussianBlur(fg,(0,0),8)*0.6; OV(img,fr,fa)
        g=np.clip((_yy-FH*0.68)/(FH*0.32),0,1)[...,None]**1.4
        img*=1-0.78*g*eout(tr/1.2)
        ke=eout((tr-1.0)/0.8)
        if ke>0:
            em=Cv(); leaf_emblem(em,(FW/2,150),62,ke,t); er,ea=em.f()
            img+=cv2.GaussianBlur(er,(0,0),8)*0.6*ke; OV(img,er,ea*ke)
        kt=eout((tr-1.3)/1.1,3)
        if kt>0:
            band=band_at(text_spaced('SONYU',F_EN,int(70-40*kt)),1590)
            img+=cv2.GaussianBlur(band,(0,0),16)[...,None]*np.array(TEAL,np.float32)*0.9*kt
            col=grad_fill(band,(0.92,1.0,0.97),(0.45,0.92,0.84))
            img[...]=img*(1-band[...,None]*kt)+col*kt
            su=(tr-2.5)/0.8
            if 0<su<1:
                sh=np.exp(-((_xx-(-200+su*1480)+(_yy-1590)*0.4)/60)**2)*band
                img+=sh[...,None]*np.array([1.0,0.6,0.6],np.float32)*0.9
        kk=eout((tr-1.9)/0.9)
        if kk>0:
            dv=Cv(); y=1694; w=260*kk
            dv.lines([(FW/2-w,y),(FW/2-26,y)],TEAL_L,2); dv.lines([(FW/2+26,y),(FW/2+w,y)],RED_L,2)
            dv.poly([(FW/2,y-9),(FW/2+9,y),(FW/2,y+9),(FW/2-9,y)],(1,1,1))
            dr,da=dv.f(); img+=cv2.GaussianBlur(dr,(0,0),4); OV(img,dr,da)
            b1=band_at(text_plain('에피소드 5',F_EP),1742)
            img[...]=img*(1-b1[...,None]*kk)+b1[...,None]*np.array(RED_L,np.float32)*kk
            k2=eout((tr-2.2)/0.9)
            if k2>0:
                b2=band_at(text_plain('죽음을 먹고 괴물이 되어라',F_KR),1806)
                img+=cv2.GaussianBlur(b2,(0,0),8)[...,None]*np.array(TEAL,np.float32)*0.45*k2
                img[...]=img*(1-b2[...,None]*k2)+b2[...,None]*np.array([0.96,1.0,0.98],np.float32)*k2
    vig=np.clip(1-(np.hypot((_xx-FW/2)/FW,(_yy-FH/2)/FH)**2)*1.0,0.4,1)[...,None]; img*=vig
    # cut transitions: a quick slash wipe (red/teal) instead of a white flash
    for i,tb in enumerate((T3,T4,T5)):
        u=t-tb
        if -0.06<u<0.18:
            sc=Cv(); a=math.radians(-30 if i%2 else 25); tx,ty=math.cos(a),math.sin(a); nx,ny=-ty,tx
            c=np.array([FW/2,FH/2]); p=eout((u+0.06)/0.08)
            A=c-np.array([tx,ty])*1500; B=A+np.array([tx,ty])*3000*p; w=30*(1-clamp(u/0.18))
            sc.poly([A,B+np.array([nx,ny])*w,B-np.array([nx,ny])*w*0.2],(1,0.9,0.9))
            sr,sa=sc.f(); img+=cv2.GaussianBlur(sr,(0,0),12)*np.array(RED if i%2 else TEAL,np.float32)*2; OV(img,sr,sa)
    img+=math.exp(-((t-T2)/0.12)**2)*1.2*np.array([1.0,0.92,0.92],np.float32)
    img+=sum(math.exp(-((t-tb)/0.05)**2) for tb in (T3,T4,T5))*0.35*np.array([1.0,0.92,0.92],np.float32)
    return to8(img)
if __name__=='__main__':
    only=sys.argv[1:]
    if only:
        for f in map(int,only): Image.fromarray(render(f)).save(S+f'output/sy_pv_{f:03d}.png')
        sys.exit()
    out=S+'output/sonyu_motion.mp4'
    p=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{FW}x{FH}','-r',str(FPS),'-i','-',
        '-c:v','libx264','-pix_fmt','yuv420p','-crf','15','-preset','slow','-tune','animation','-movflags','+faststart',out],stdin=subprocess.PIPE)
    with mp.get_context('fork').Pool(3) as pool:
        for i,fr in enumerate(pool.imap(render,range(N),chunksize=2)):
            p.stdin.write(fr.tobytes())
            if i%30==0: print(i,flush=True)
    p.stdin.close(); p.wait(); print('done',out)
