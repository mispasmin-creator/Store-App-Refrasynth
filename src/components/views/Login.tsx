import { z } from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ClipLoader as Loader } from 'react-spinners';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Eye, EyeClosed } from 'lucide-react';
import Logo from '../element/Logo';
import { toast } from 'sonner';

export default () => {
    const { login, loggedIn } = useAuth();
    const [visible, setVisible] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (loggedIn) {
            navigate('/');
        }
    }, [loggedIn]);

    const schema = z.object({
        username: z.string().nonempty(),
        password: z.string().nonempty(),
    });

    const form = useForm({ resolver: zodResolver(schema) });

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            const res = await login(values.username, values.password);
            if (!res) {
                toast.error("Invalid Username or Password")
            }
        } catch {
            toast.error("Something went wrong! Try again")
        }
    }

    function onError(e: any) {
        console.log(e);
    }

    return (
        <div className="grid place-items-center h-screen bg-gradient-to-br from-green-100 via-emerald-50 to-green-50">
            <Card className="w-full max-w-sm">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onError)} className="grid gap-6">
                        <CardHeader className="text-center flex justify-center flex-col items-center">
                            <Logo size={40} />
                            <CardTitle className="font-bold text-3xl">Store App</CardTitle>
                            <CardDescription>Please login to your account</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Username</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Enter username" />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={visible ? 'text' : 'password'}
                                                    placeholder="Enter password"
                                                    {...field}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-transparent active:bg-transparent"
                                                    tabIndex={-1}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setVisible(!visible);
                                                    }}
                                                >
                                                    {visible ? <EyeClosed /> : <Eye />}
                                                    <span className="sr-only">
                                                        Toggle password visibility
                                                    </span>
                                                </Button>
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </CardContent>

                        <CardFooter>
                            <Button
                                type="submit"
                                className="bg-gradient-to-br from-green-600 to-emerald-600 font-medium w-full"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting && (
                                    <Loader size={20} color="white" aria-label="Loading Spinner" />
                                )}
                                Login
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
};
