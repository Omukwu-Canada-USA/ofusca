const menuBtn=document.querySelector('.menu-btn');
const links=document.querySelector('.links');
if(menuBtn&&links){menuBtn.addEventListener('click',()=>links.classList.toggle('open'));links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>links.classList.remove('open')))}
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());

// OFUSCA front-end protective helpers.
// These do not replace server-side security, but they reduce spam, unsafe submissions,
// accidental oversized uploads, and unsafe external-link behavior.
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('a[href^="http"]').forEach(a=>{
    a.setAttribute('rel','noopener noreferrer');
    a.setAttribute('target','_blank');
  });

  document.querySelectorAll('form').forEach(form=>{
    form.addEventListener('submit',event=>{
      const honey=form.querySelector('[name="bot-field"]');
      if(honey&&honey.value.trim()!==''){
        event.preventDefault();
        return false;
      }

      const fileInputs=form.querySelectorAll('input[type="file"]');
      for(const input of fileInputs){
        for(const file of input.files){
          const maxSize=10*1024*1024; // 10 MB
          const allowed=['image/jpeg','image/png','image/webp','application/pdf'];
          if(file.size>maxSize){
            event.preventDefault();
            alert('For security, each uploaded file must be 10 MB or smaller.');
            return false;
          }
          if(file.type&&!allowed.includes(file.type)){
            event.preventDefault();
            alert('For security, uploads must be JPG, PNG, WEBP, or PDF files only.');
            return false;
          }
        }
      }
    });
  });



  // Human/robot verification support for protected forms.
  // The real challenge is completed by Netlify reCAPTCHA on the live site.
  // This client-side layer adds a time check and browser-generated token to reduce simple spam bots.
  document.querySelectorAll('form[data-human-protected="true"]').forEach(form=>{
    const started=form.querySelector('[data-human-started-at]');
    const browserCheck=form.querySelector('[data-human-browser-check]');
    if(started){ started.value=String(Date.now()); }
    if(browserCheck){ browserCheck.value='js-enabled-'+Math.random().toString(36).slice(2); }

    form.addEventListener('submit',event=>{
      const requiredConfirm=form.querySelector('[name="human_confirmation"]');
      if(requiredConfirm && !requiredConfirm.checked){
        event.preventDefault();
        alert('Please confirm the human verification checkbox before submitting.');
        return false;
      }
      if(started){
        const elapsed=Date.now()-Number(started.value || 0);
        if(elapsed>0 && elapsed<3000){
          event.preventDefault();
          alert('For security, please wait a moment before submitting the form.');
          return false;
        }
      }
    });
  });

});

// Optional Google Sheets submission bridge.
// If OFUSCA_CONFIG.GOOGLE_APPS_SCRIPT_ENDPOINT is replaced with a real endpoint,
// forms marked data-google-sheet="true" can post a copy of submissions to Google Sheets.
// Netlify Forms still works as the default collection method.
document.addEventListener('DOMContentLoaded',()=>{
  const cfg=window.OFUSCA_CONFIG||{};
  const endpoint=cfg.GOOGLE_APPS_SCRIPT_ENDPOINT||'';
  const ready=endpoint && !endpoint.includes('PASTE_GOOGLE_APPS_SCRIPT');
  document.querySelectorAll('form[data-google-sheet="true"]').forEach(form=>{
    if(!ready){return;}
    form.addEventListener('submit',()=>{
      try{
        const fd=new FormData(form);
        const data={source:form.getAttribute('name')||'ofusca-website'};
        fd.forEach((value,key)=>{
          if(value instanceof File){ data[key]=value.name || ''; }
          else if(data[key]){ data[key]=String(data[key])+', '+String(value); }
          else{ data[key]=String(value); }
        });
        navigator.sendBeacon(endpoint,new Blob([JSON.stringify(data)],{type:'application/json'}));
      }catch(err){ console.warn('Google Sheets sync skipped:',err); }
    });
  });
});
