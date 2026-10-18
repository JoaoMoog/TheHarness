export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'){
  const {loadAwsSecrets}=await import('./server/secrets');
  await loadAwsSecrets();
 }
}
